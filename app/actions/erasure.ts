"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { erasureRequests, user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { getSchoolMembership } from "@/lib/account"
import {
  appendEvent,
  countSchoolAdmins,
  getErasureContext,
  getRequest,
  listEvents,
  listRequestsForSchool,
  setStatus,
  recordRequest,
  type ErasureContext,
  type ErasureEvent,
  type ErasureRequestSummary,
} from "@/lib/erasure-requests"
import {
  ERASURE_STATUSES,
  REQUESTER_BASES,
  resolveErasureRole,
  type ErasureStatus,
  type RequesterBasis,
} from "@/lib/erasure"

/**
 * Erasure request handling.
 *
 * Every action resolves the caller from the session and never accepts a user id
 * from the client, so a request can only ever be made about yourself or about
 * someone your school actually controls.
 *
 * None of these actions delete data. They record what was asked, by whom, on
 * whose authority, and what was decided. The deletion itself is carried out
 * manually against the plan in lib/erasure.ts, because the schema's missing
 * foreign keys mean an automated delete would orphan pupil work rather than
 * remove it.
 */

/** What erasing the signed-in user's own account would involve. */
export async function getMyErasureContext(): Promise<ErasureContext> {
  const me = await requireUser()
  return getErasureContext(me.id)
}

export type SubmitResult =
  | { ok: true; reference: string; referredToSchool: boolean }
  | { ok: false; message: string }

/**
 * Ask for your own account to be erased.
 *
 * A school-managed account's request is recorded and referred to the school
 * rather than actioned, because the school is the controller and decides what
 * happens to work produced for it. The requester is told that is what happened.
 */
export async function submitErasureRequest(formData: FormData): Promise<SubmitResult> {
  const me = await requireUser()

  const basisRaw = String(formData.get("basis") ?? "self")
  const basis: RequesterBasis = (REQUESTER_BASES as readonly string[]).includes(basisRaw)
    ? (basisRaw as RequesterBasis)
    : "self"

  // A parent or guardian acting for a child is asking on someone else's
  // behalf. That is allowed, but it needs establishing rather than asserting,
  // so it is recorded as a claim to be verified and never auto-confirmed.
  if (basis === "school" || basis === "teacher") {
    return {
      ok: false,
      message:
        "A school or teacher cannot submit this form on someone else's behalf. Use the school's erasure queue instead, so the request is recorded against the right authority.",
    }
  }

  const detail = String(formData.get("detail") ?? "").trim().slice(0, 2000)

  const context = await getErasureContext(me.id)
  if (context.openRequest) {
    return {
      ok: false,
      message: `You already have an open request (${context.openRequest.reference}). We will respond to that one rather than starting a second.`,
    }
  }

  const [record] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, me.id))
    .limit(1)
  if (!record) return { ok: false, message: "We could not read your account." }

  const membership = await getSchoolMembership(me.id)
  const role = resolveErasureRole(context.subject)

  const { reference } = await recordRequest({
    subjectUserId: me.id,
    subjectName: record.name,
    subjectEmail: record.email,
    subjectRole: role,
    schoolId: membership?.schoolId ?? null,
    requestedBy: me.id,
    requesterBasis: basis,
    detail,
    actorLabel: record.name,
  })

  revalidatePath("/account")
  return { ok: true, reference, referredToSchool: Boolean(membership?.schoolId) }
}

export type WithdrawResult = { ok: true } | { ok: false; message: string }

/** Withdraw your own open request. */
export async function withdrawErasureRequest(requestId: number): Promise<WithdrawResult> {
  const me = await requireUser()
  const request = await getRequest(requestId)
  if (!request) return { ok: false, message: "That request no longer exists." }
  if (request.subjectUserId !== me.id) {
    return { ok: false, message: "That request is not yours to withdraw." }
  }
  if (request.status === "completed") {
    return { ok: false, message: "That request has already been completed." }
  }

  await setStatus({
    requestId,
    status: "withdrawn",
    actorId: me.id,
    actorLabel: me.name,
    note: "Withdrawn by the account holder.",
  })

  revalidatePath("/account")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// School administrator queue
// ---------------------------------------------------------------------------

export type SchoolErasureQueue = {
  schoolName: string
  requests: ErasureRequestSummary[]
}

/**
 * The requests a school administrator is responsible for.
 *
 * Returns null for anyone who is not an active administrator of a school, so
 * the queue simply does not render rather than erroring.
 */
export async function getSchoolErasureQueue(): Promise<SchoolErasureQueue | null> {
  const me = await requireUser()
  const membership = await getSchoolMembership(me.id)
  if (!membership?.isAdmin) return null

  return {
    schoolName: membership.schoolName,
    requests: await listRequestsForSchool(membership.schoolId),
  }
}

/** The audit trail for one request, visible to its subject or their school. */
export async function getErasureTrail(requestId: number): Promise<ErasureEvent[]> {
  const me = await requireUser()
  const request = await getRequest(requestId)
  if (!request) return []

  if (request.subjectUserId !== me.id) {
    const membership = await getSchoolMembership(me.id)
    const sameSchool = membership?.isAdmin && membership.schoolId === request.schoolId
    if (!sameSchool) return []
  }

  return listEvents(requestId)
}

export type AdminActionResult = { ok: true } | { ok: false; message: string }

type AdminGuard =
  | { allowed: false; message: string }
  | { allowed: true; me: Awaited<ReturnType<typeof requireUser>> }

/**
 * Only an administrator of the school that actually controls the account may
 * act on its request. Checked per request rather than once per page, so a
 * request belonging to another school cannot be moved by guessing its id.
 */
async function requireSchoolAdminFor(requestId: number): Promise<AdminGuard> {
  const me = await requireUser()
  const request = await getRequest(requestId)
  if (!request) return { allowed: false, message: "That request no longer exists." }

  const membership = await getSchoolMembership(me.id)
  if (!membership?.isAdmin || membership.schoolId !== request.schoolId) {
    return {
      allowed: false,
      message: "You are not an administrator of the school that controls this account.",
    }
  }
  return { allowed: true, me }
}

/**
 * Record that identity or authority has been established.
 *
 * These are kept as two separate confirmations because they answer different
 * questions: whether the requester is who they say they are, and whether they
 * are entitled to ask on this account's behalf. A parent is often verifiably
 * themselves and still needs their relationship to the pupil established.
 */
export async function confirmErasureVerification(
  requestId: number,
  kind: "identity" | "authority",
  method: string,
): Promise<AdminActionResult> {
  const resolved = await requireSchoolAdminFor(requestId)
  if (!resolved.allowed) return { ok: false, message: resolved.message }
  const { me } = resolved

  const trimmed = method.trim().slice(0, 300)
  if (trimmed.length < 3) {
    return { ok: false, message: "Record how this was checked, so the decision can be justified later." }
  }

  const now = new Date()
  await db
    .update(erasureRequests)
    .set(
      kind === "identity"
        ? { identityVerifiedAt: now, identityVerifiedBy: me.id, identityMethod: trimmed, updatedAt: now }
        : { authorityConfirmedAt: now, authorityConfirmedBy: me.id, updatedAt: now },
    )
    .where(eq(erasureRequests.id, requestId))

  await appendEvent({
    requestId,
    actorId: me.id,
    actorLabel: me.name,
    kind: kind === "identity" ? "identity_verified" : "authority_confirmed",
    note: trimmed,
  })

  revalidatePath("/school")
  return { ok: true }
}

/** Move a request along, with a note saying why. */
export async function advanceErasureRequest(
  requestId: number,
  status: string,
  note: string,
): Promise<AdminActionResult> {
  const resolved = await requireSchoolAdminFor(requestId)
  if (!resolved.allowed) return { ok: false, message: resolved.message }
  const { me } = resolved

  if (!(ERASURE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Unknown status." }
  }
  const next = status as ErasureStatus
  const trimmed = note.trim().slice(0, 1000)

  // Completion and refusal are the two outcomes a regulator would ask about,
  // so neither can be recorded without a reason.
  if ((next === "completed" || next === "refused") && trimmed.length < 3) {
    return {
      ok: false,
      message:
        next === "completed"
          ? "Record what was actually deleted, transferred or retained before marking this complete."
          : "A refusal has to state its grounds, because the requester must be told them.",
    }
  }

  if (next === "completed" || next === "refused") {
    await db
      .update(erasureRequests)
      .set({
        decision: next === "completed" ? "fulfilled" : "refused",
        decisionRationale: trimmed,
        updatedAt: new Date(),
      })
      .where(eq(erasureRequests.id, requestId))
  }

  await setStatus({
    requestId,
    status: next,
    actorId: me.id,
    actorLabel: me.name,
    note: trimmed || `Moved to ${next.replace(/_/g, " ")}.`,
  })

  revalidatePath("/school")
  return { ok: true }
}

/** How many administrators a pupil's request was referred to. */
export async function getControllerContactCount(): Promise<number> {
  const me = await requireUser()
  const membership = await getSchoolMembership(me.id)
  if (!membership) return 0
  return countSchoolAdmins(membership.schoolId)
}
