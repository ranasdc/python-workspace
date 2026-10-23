/**
 * The erasure policy: what actually happens to each record when someone asks
 * to be deleted, and who is allowed to decide.
 *
 * This module is deliberately pure — no database, no session — so the policy
 * can be read, reviewed and unit tested on its own. Acting on a plan is the
 * job of app/actions/erasure.ts.
 *
 * Two things drive every decision here:
 *
 *  1. **Who the controller is.** For an individual account MyCodePad decides.
 *     For a school-managed account the school decides and MyCodePad acts on
 *     its documented instruction. The same button cannot mean both things.
 *
 *  2. **Who the data is about.** A teacher asking to be erased must not take
 *     a class of pupils' work with them, because that work is the pupils'
 *     personal data and in a school context the school's record. Erasing the
 *     teacher means removing the teacher's identifiers, not the classroom.
 *
 * The cascade facts below were read from the live database with an
 * information_schema query, not inferred from the Drizzle definitions, because
 * most tables reference users by a plain text column with no foreign key at
 * all and would silently orphan rather than delete.
 */

/** What should happen to a group of records. */
export type Disposition =
  /** Remove the rows. They are personal data about the subject and nothing else. */
  | "delete"
  /** Keep the row, strip the subject's identifier from it. */
  | "anonymise"
  /** Hand ownership to someone else before the account can go. */
  | "reassign"
  /** Keep. It belongs to the school or to another person. */
  | "retain"
  /** Withdraw external access immediately, ahead of any other step. */
  | "revoke"
  /** Cannot be deleted on request; another legal obligation holds it. */
  | "blocked"

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  delete: "Delete",
  anonymise: "Anonymise",
  reassign: "Transfer ownership",
  retain: "Retain",
  revoke: "Revoke access",
  blocked: "Blocked",
}

export type ErasureStep = {
  /** What a non-technical reader would call this. */
  label: string
  /** The tables and columns involved, named so a reviewer can check them. */
  records: string
  disposition: Disposition
  /** Why this disposition and not deletion. */
  reason: string
  /**
   * True when the database removes these rows by itself once the user row
   * goes. Everything else has to be done explicitly, in order.
   */
  automatic: boolean
}

/** The kind of account being erased, which decides the whole plan. */
export type ErasureRole =
  | "individual_student"
  | "school_student"
  | "independent_teacher"
  | "school_teacher"
  | "school_admin"

export const ERASURE_ROLE_LABELS: Record<ErasureRole, string> = {
  individual_student: "Individual learner",
  school_student: "School-managed pupil",
  independent_teacher: "Independent teacher or tutor",
  school_teacher: "School teacher",
  school_admin: "School administrator",
}

export type ErasureSubject = {
  isTeacher: boolean
  isSchoolAdmin: boolean
  /** Null when the person uses MyCodePad independently. */
  schoolName: string | null
  /** True when this account created the school row that others depend on. */
  foundedSchool: boolean
  /** Classes they own that still contain other people's pupils. */
  ownedClassCount: number
  /** True when their own card is being charged. */
  hasBillableSubscription: boolean
  /** Public share links they have published and not revoked. */
  activeShareCount: number
}

export type ErasurePlan = {
  role: ErasureRole
  roleLabel: string
  /** Who decides whether this erasure happens. */
  controller: "MyCodePad" | "school"
  controllerDetail: string
  /** Whose authority must be established before anything is actioned. */
  authority: string
  /**
   * Things that must be resolved before the account can be removed at all.
   * A non-empty list means the request cannot simply be actioned.
   */
  blockers: string[]
  steps: ErasureStep[]
}

export function resolveErasureRole(subject: ErasureSubject): ErasureRole {
  if (subject.isSchoolAdmin) return "school_admin"
  if (subject.isTeacher) {
    return subject.schoolName ? "school_teacher" : "independent_teacher"
  }
  return subject.schoolName ? "school_student" : "individual_student"
}

/**
 * The statutory deadline for responding to a rights request.
 *
 * One month from receipt under UK GDPR Article 12(3). This is the only period
 * in the erasure flow that is stated as a fact, because it is set by law
 * rather than chosen by the operator. Every other retention period lives in
 * LEGAL_FACTS and stays unset until it has been confirmed.
 */
export const RIGHTS_REQUEST_RESPONSE_DAYS = 30

export function responseDeadline(receivedAt: Date): Date {
  const due = new Date(receivedAt)
  due.setMonth(due.getMonth() + 1)
  return due
}

/** Records the database removes by itself, verified against the live schema. */
const CASCADING_STEPS: ErasureStep[] = [
  {
    label: "Sign-in credentials",
    records: "account.userId, session.userId",
    disposition: "delete",
    reason:
      "Password hash, any OAuth tokens and every active session. Both cascade from the user row, so they go as soon as the account does.",
    automatic: true,
  },
]

/**
 * The plan for one person.
 *
 * Steps are returned in the order they must be carried out: revocations first
 * so nothing stays publicly readable while the rest is worked through, then
 * transfers, then deletions, then whatever is being kept and why.
 */
export function planErasure(subject: ErasureSubject): ErasurePlan {
  const role = resolveErasureRole(subject)
  const steps: ErasureStep[] = []
  const blockers: string[] = []

  if (subject.activeShareCount > 0) {
    steps.push({
      label: "Public share links",
      records: "file_share.ownerId → revokedAt",
      disposition: "revoke",
      reason:
        `${subject.activeShareCount} published link${subject.activeShareCount === 1 ? "" : "s"} can be opened by anyone holding the token. Revoking is the first step of any erasure because it is the only one that stops data continuing to leave the platform while the request is handled.`,
      automatic: false,
    })
  }

  // ---- School administrators: the cascade that would take the school with them
  if (role === "school_admin") {
    if (subject.foundedSchool) {
      blockers.push(
        "This account created the school. school.createdBy cascades on delete, so removing the user row would delete the school and, with it, every membership, invite code and the school subscription. School ownership must be transferred to another administrator before the account can be removed.",
      )
      steps.push({
        label: "School ownership",
        records: "school.createdBy",
        disposition: "reassign",
        reason:
          "Must point at a remaining administrator before deletion. This is a hard prerequisite, not a cleanup step.",
        automatic: false,
      })
    }
    steps.push({
      label: "School, members and invite codes",
      records: "school, school_member, invite_code, school_subscription",
      disposition: "retain",
      reason:
        "The school is a separate organisation with its own members and contract. An administrator leaving does not end it.",
      automatic: false,
    })
  }

  // ---- Teachers: the classroom stays, the teacher's identifiers go
  if (role === "independent_teacher" || role === "school_teacher") {
    const schoolOwned = role === "school_teacher"
    if (subject.ownedClassCount > 0) {
      blockers.push(
        `${subject.ownedClassCount} class${subject.ownedClassCount === 1 ? "" : "es"} are owned by this account and contain other people's pupils and their work. class.teacherId has no foreign key, so deleting the user would orphan them rather than remove them. Each class must be transferred or closed first.`,
      )
    }
    steps.push({
      label: "Classes and enrolled pupils",
      records: "class.teacherId, enrollment, student_folder, code_file",
      disposition: schoolOwned ? "retain" : "reassign",
      reason: schoolOwned
        ? "School-owned classes and the pupil work inside them are the school's record. They are transferred to another teacher on the school's instruction, never deleted because a teacher left."
        : "The work inside belongs to the pupils, not the teacher. Classes are transferred to a named replacement, or closed with an export offered to each pupil, before the account is removed.",
      automatic: false,
    })
    steps.push({
      label: "Feedback left on pupils' work",
      records: "file_comment.teacherId, file_comment.teacherName",
      disposition: "anonymise",
      reason:
        "The comment is feedback a pupil may still rely on, but teacherName is a copy of the teacher's name stored on the row. The identifiers are cleared and the feedback is kept.",
      automatic: false,
    })
    steps.push({
      label: "Lesson material and tasks",
      records: "library_file.teacherId, library_folder.teacherId, file_task.teacherId, daily_starter.teacherId",
      disposition: schoolOwned ? "reassign" : "delete",
      reason: schoolOwned
        ? "Material produced for the school is transferred on its instruction, because classes still running may depend on it."
        : "The teacher's own material, deleted with the account unless a class still depends on a starter that has been set.",
      automatic: false,
    })
    steps.push({
      label: "AI usage counters",
      records: "ai_task_usage.teacherId",
      disposition: "delete",
      reason: "A monthly quota counter with no purpose once the account is gone.",
      automatic: false,
    })
  }

  // ---- Pupils: their own work, and who gets to decide about it
  if (role === "individual_student" || role === "school_student") {
    const schoolManaged = role === "school_student"
    steps.push({
      label: "Code, folders and personal workspace",
      records: "code_file.studentId, student_folder.studentId, class.isPersonal",
      disposition: schoolManaged ? "retain" : "delete",
      reason: schoolManaged
        ? "Work produced for school is the school's record as well as the pupil's personal data. It is exported or deleted on the school's documented instruction, not automatically on request."
        : "The learner's own work on their own account. Deleted with the account.",
      automatic: false,
    })
    steps.push({
      label: "Class enrolments",
      records: "enrollment.studentId",
      disposition: "delete",
      reason:
        "A membership record with no value once the pupil has gone. No foreign key, so it must be deleted explicitly.",
      automatic: false,
    })
    steps.push({
      label: "Starter quiz activity and AI help unlocks",
      records: "daily_starter_response.studentId, daily_starter_open.studentId, ai_help_unlock.studentId",
      disposition: "delete",
      reason:
        "Activity data about one pupil. Scores are visible only to their own teacher and serve no purpose afterwards.",
      automatic: false,
    })
    steps.push({
      label: "Feedback received from teachers",
      records: "file_comment.fileId",
      disposition: "delete",
      reason:
        "Comments are attached to the pupil's files, so they go when those files go. They are about the pupil and are not needed once the work is removed.",
      automatic: false,
    })
  }

  if (role === "school_student" || role === "school_teacher" || role === "school_admin") {
    steps.push({
      label: "School membership",
      records: "school_member.userId",
      disposition: "delete",
      reason:
        "Cascades from the user row. Note that using the school's own \"remove member\" control instead only sets status to removed and leaves the membership, classes and work in place — that is not erasure.",
      automatic: true,
    })
  }

  // ---- Billing: the one thing a request cannot clear
  if (subject.hasBillableSubscription) {
    steps.push({
      label: "Billing and tax records",
      records: "subscription.userId, Stripe customer and invoice records",
      disposition: "blocked",
      reason:
        "The subscription row cascades, but the invoice and tax records held by Stripe and required for the operator's own accounts do not come within scope of an erasure request. The retention period that applies has not been confirmed yet and is listed as an outstanding legal fact.",
      automatic: false,
    })
  }

  steps.push(...CASCADING_STEPS)

  steps.push({
    label: "Account identity",
    records: "user.name, user.email, user.image",
    disposition: "delete",
    reason:
      "Removed last, once everything that references it by a plain text id has been dealt with. Deleting it first is what would orphan the rest.",
    automatic: false,
  })

  const controller = role === "individual_student" ? "MyCodePad" : role === "school_student" ? "school" : subject.schoolName ? "school" : "MyCodePad"

  return {
    role,
    roleLabel: ERASURE_ROLE_LABELS[role],
    controller,
    controllerDetail:
      controller === "school"
        ? `${subject.schoolName ?? "The school"} is the controller for this account. MyCodePad processes on its instruction, so the school has to authorise the erasure and decide what happens to work produced for it.`
        : "MyCodePad is the controller for this account and decides the request directly.",
    authority:
      role === "school_student"
        ? "Confirmation from the school, plus proportionate identity verification. A request made by a pupil is passed to their school rather than actioned directly."
        : role === "individual_student"
          ? "Proof that the requester controls the account's email address. Where the account holder is a child, a parent or guardian may request on their behalf once that relationship is established."
          : "Proof of control of the account email, and for a school account the school's agreement to the transfer of anything it owns.",
    blockers,
    steps,
  }
}

// ---------------------------------------------------------------------------
// Request tracking vocabulary
// ---------------------------------------------------------------------------

export const ERASURE_STATUSES = [
  "received",
  "verifying_identity",
  "awaiting_school",
  "in_progress",
  "completed",
  "refused",
  "withdrawn",
] as const

export type ErasureStatus = (typeof ERASURE_STATUSES)[number]

export const ERASURE_STATUS_LABELS: Record<ErasureStatus, string> = {
  received: "Received",
  verifying_identity: "Verifying identity",
  awaiting_school: "Awaiting school instruction",
  in_progress: "In progress",
  completed: "Completed",
  refused: "Refused",
  withdrawn: "Withdrawn",
}

/** Statuses that stop the clock because the request is finished. */
export const CLOSED_ERASURE_STATUSES: ErasureStatus[] = [
  "completed",
  "refused",
  "withdrawn",
]

export function isClosed(status: ErasureStatus): boolean {
  return CLOSED_ERASURE_STATUSES.includes(status)
}

/** On whose authority the request was made. */
export const REQUESTER_BASES = ["self", "parent_guardian", "school", "teacher"] as const
export type RequesterBasis = (typeof REQUESTER_BASES)[number]

export const REQUESTER_BASIS_LABELS: Record<RequesterBasis, string> = {
  self: "The account holder",
  parent_guardian: "A parent or guardian",
  school: "The school, as controller",
  teacher: "A teacher, for a pupil in their class",
}

/**
 * Days remaining against the statutory deadline. Negative means overdue, which
 * the queue shows rather than hides.
 */
export function daysRemaining(dueBy: Date, now: Date = new Date()): number {
  const ms = new Date(dueBy).getTime() - now.getTime()
  return Math.ceil(ms / 86_400_000)
}

/** A short, quotable reference so a requester can chase their request. */
export function buildReference(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "")
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `ER-${stamp}-${suffix}`
}
