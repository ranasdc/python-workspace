import { and, count, desc, eq, isNull, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  classes,
  enrollments,
  erasureRequestEvents,
  erasureRequests,
  fileShares,
  schoolMembers,
  schools,
  subscriptions,
  user,
} from "@/lib/db/schema"
import { getEntitlement, isSchoolAdminRole, type SchoolRole } from "@/lib/entitlements"
import { getSchoolMembership } from "@/lib/account"
import {
  buildReference,
  planErasure,
  responseDeadline,
  type ErasurePlan,
  type ErasureStatus,
  type ErasureSubject,
  type RequesterBasis,
} from "@/lib/erasure"

/**
 * Reading and recording erasure requests.
 *
 * The policy itself lives in lib/erasure.ts and knows nothing about the
 * database. This module's job is to assemble the facts that policy needs for a
 * real person, and to keep the audit trail honest when a request moves.
 *
 * Nothing here deletes anything. Deletion is performed by hand against a
 * verified procedure, because several tables reference users by a plain text
 * column with no foreign key and would orphan rather than cascade. Writing an
 * automatic delete against that schema is how pupil work gets silently
 * destroyed or silently left behind.
 */

export type ErasureContext = {
  subject: ErasureSubject
  plan: ErasurePlan
  /** Open request for this person, if they already have one. */
  openRequest: ErasureRequestSummary | null
  history: ErasureRequestSummary[]
  /** False once the account itself has been removed, leaving only the record. */
  accountExists: boolean
}

export type ErasureRequestSummary = {
  id: number
  reference: string
  subjectUserId: string
  subjectLabel: string
  subjectRole: string
  schoolId: number | null
  requesterBasis: string
  detail: string
  status: ErasureStatus
  dueBy: Date
  identityVerifiedAt: Date | null
  authorityConfirmedAt: Date | null
  decision: string | null
  decisionRationale: string | null
  completedAt: Date | null
  createdAt: Date
}

/**
 * Everything needed to describe what erasing this account would involve.
 *
 * The counts are real queries rather than estimates, because they decide
 * whether the request can be actioned at all: a teacher holding live classes
 * has a blocker, and showing them "0 classes" would promise a deletion that
 * cannot safely happen.
 */
export async function getErasureContext(userId: string): Promise<ErasureContext> {
  const [entitlement, membership, record] = await Promise.all([
    getEntitlement(userId),
    getSchoolMembership(userId),
    db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1),
  ])

  const isTeacher = entitlement.isTeacher
  const schoolId = membership?.schoolId ?? null

  const [teacherClasses, activeShares, ownSubscription, foundedSchools, requests] =
    await Promise.all([
      // Counted as classes, not enrolments: one class of thirty pupils is a
      // single thing to transfer, and a personal workspace holds nobody else's
      // work so it never blocks an erasure.
      isTeacher
        ? db
            .select({ id: classes.id })
            .from(classes)
            .where(and(eq(classes.teacherId, userId), eq(classes.isPersonal, false)))
        : Promise.resolve([]),
      db
        .select({ n: count(fileShares.id) })
        .from(fileShares)
        .where(and(eq(fileShares.ownerId, userId), isNull(fileShares.revokedAt))),
      db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1),
      schoolId
        ? db
            .select({ id: schools.id })
            .from(schools)
            .where(and(eq(schools.id, schoolId), eq(schools.createdBy, userId)))
            .limit(1)
        : Promise.resolve([]),
      listRequestsForSubject(userId),
    ])

  const subject: ErasureSubject = {
    isTeacher,
    isSchoolAdmin: Boolean(membership?.isAdmin),
    schoolName: membership?.schoolName ?? null,
    foundedSchool: foundedSchools.length > 0,
    ownedClassCount: teacherClasses.length,
    hasBillableSubscription: ownSubscription.length > 0,
    activeShareCount: Number(activeShares[0]?.n ?? 0),
  }

  return {
    subject,
    plan: planErasure(subject),
    openRequest: requests.find((r) => !isClosedStatus(r.status)) ?? null,
    history: requests,
    accountExists: record.length > 0,
  }
}

function isClosedStatus(status: ErasureStatus): boolean {
  return status === "completed" || status === "refused" || status === "withdrawn"
}

export async function listRequestsForSubject(userId: string): Promise<ErasureRequestSummary[]> {
  const rows = await db
    .select()
    .from(erasureRequests)
    .where(eq(erasureRequests.subjectUserId, userId))
    .orderBy(desc(erasureRequests.createdAt))
  return rows.map(toSummary)
}

/**
 * The queue a school administrator works through.
 *
 * Scoped to the caller's own school, and the caller's admin role is checked by
 * the action before this is reached. An administrator of one school must never
 * see another school's pupils.
 */
export async function listRequestsForSchool(schoolId: number): Promise<ErasureRequestSummary[]> {
  const rows = await db
    .select()
    .from(erasureRequests)
    .where(eq(erasureRequests.schoolId, schoolId))
    .orderBy(desc(erasureRequests.createdAt))
  return rows.map(toSummary)
}

function toSummary(row: typeof erasureRequests.$inferSelect): ErasureRequestSummary {
  return {
    id: row.id,
    reference: row.reference,
    subjectUserId: row.subjectUserId,
    subjectLabel: row.subjectLabel,
    subjectRole: row.subjectRole,
    schoolId: row.schoolId,
    requesterBasis: row.requesterBasis,
    detail: row.detail,
    status: row.status as ErasureStatus,
    dueBy: row.dueBy,
    identityVerifiedAt: row.identityVerifiedAt,
    authorityConfirmedAt: row.authorityConfirmedAt,
    decision: row.decision,
    decisionRationale: row.decisionRationale,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  }
}

export type ErasureEvent = {
  id: number
  actorLabel: string
  kind: string
  note: string
  createdAt: Date
}

export async function listEvents(requestId: number): Promise<ErasureEvent[]> {
  const rows = await db
    .select({
      id: erasureRequestEvents.id,
      actorLabel: erasureRequestEvents.actorLabel,
      kind: erasureRequestEvents.kind,
      note: erasureRequestEvents.note,
      createdAt: erasureRequestEvents.createdAt,
    })
    .from(erasureRequestEvents)
    .where(eq(erasureRequestEvents.requestId, requestId))
    .orderBy(erasureRequestEvents.createdAt)
  return rows
}

/**
 * Record a new request.
 *
 * The subject's name, email and role are copied onto the row rather than
 * joined, because the whole point of the record is to remain meaningful after
 * the account it refers to has been deleted.
 */
export async function recordRequest(input: {
  subjectUserId: string
  subjectName: string
  subjectEmail: string
  subjectRole: string
  schoolId: number | null
  requestedBy: string
  requesterBasis: RequesterBasis
  detail: string
  actorLabel: string
}): Promise<{ id: number; reference: string }> {
  const now = new Date()
  const reference = buildReference(now)

  const [row] = await db
    .insert(erasureRequests)
    .values({
      reference,
      subjectUserId: input.subjectUserId,
      subjectLabel: `${input.subjectName} <${input.subjectEmail}>`,
      subjectRole: input.subjectRole,
      schoolId: input.schoolId,
      requestedBy: input.requestedBy,
      requesterBasis: input.requesterBasis,
      detail: input.detail,
      // A school-managed account waits on the school's instruction, so it
      // starts in a different state from one MyCodePad decides itself.
      status: input.schoolId ? "awaiting_school" : "received",
      dueBy: responseDeadline(now),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: erasureRequests.id, reference: erasureRequests.reference })

  await db.insert(erasureRequestEvents).values({
    requestId: row.id,
    actorId: input.requestedBy,
    actorLabel: input.actorLabel,
    kind: "submitted",
    note: input.schoolId
      ? "Request received and referred to the school as controller."
      : "Request received.",
    createdAt: now,
  })

  return row
}

export async function appendEvent(input: {
  requestId: number
  actorId: string | null
  actorLabel: string
  kind: string
  note: string
}): Promise<void> {
  await db.insert(erasureRequestEvents).values({
    requestId: input.requestId,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    kind: input.kind,
    note: input.note,
  })
}

export async function setStatus(input: {
  requestId: number
  status: ErasureStatus
  actorId: string
  actorLabel: string
  note: string
}): Promise<void> {
  const now = new Date()
  const patch: Partial<typeof erasureRequests.$inferInsert> = {
    status: input.status,
    updatedAt: now,
  }
  if (input.status === "completed") patch.completedAt = now

  await db.update(erasureRequests).set(patch).where(eq(erasureRequests.id, input.requestId))
  await appendEvent({
    requestId: input.requestId,
    actorId: input.actorId,
    actorLabel: input.actorLabel,
    kind: input.status === "completed" ? "completed" : "status_changed",
    note: input.note,
  })
}

/** Load one request and the school it belongs to, for authorisation checks. */
export async function getRequest(requestId: number) {
  const [row] = await db
    .select()
    .from(erasureRequests)
    .where(eq(erasureRequests.id, requestId))
    .limit(1)
  return row ?? null
}

/**
 * The school administrators who should be told about a request.
 *
 * Used to explain to a pupil who their request has gone to, without exposing
 * individual email addresses to them.
 */
export async function countSchoolAdmins(schoolId: number): Promise<number> {
  const rows = await db
    .select({ role: schoolMembers.role })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, "active")))
  return rows.filter((r) => isSchoolAdminRole(r.role as SchoolRole)).length
}

/** Subject labels for a set of requests, for the school queue. */
export async function resolveSubjectNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return new Map()
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, unique))
  return new Map(rows.map((r) => [r.id, r.name]))
}
