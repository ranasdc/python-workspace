import "server-only"

import { cache } from "react"
import { and, count, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  libraryFiles,
  libraryFolders,
  schoolMembers,
  schoolSubscriptions,
  studentFolders,
  subscriptions,
  user,
} from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { refreshSubscriptionFromStripe } from "@/lib/billing-refresh"

// This module is the ONLY place allowed to decide what a user may do.
// Nothing reads user.accountType or user.subscriptionStatus to make a decision
// any more: those columns are cosmetic leftovers and are trivially forgeable
// through the onboarding action, so they carry no authority.

export type EntitlementPlan = "free" | "student_pro" | "teacher_pro" | "school"
export type EntitlementSource = "school" | "individual" | "free"
export type SchoolRole = "student" | "teacher" | "school_admin"

export type Limits = {
  /** null means unlimited. */
  maxFiles: number | null
  maxFolders: number | null
}

export type TeacherLimits = {
  /** null means unlimited. Personal workspaces never count. */
  maxClasses: number | null
  maxStudentsPerClass: number | null
  maxLibraryFiles: number | null
  maxLibraryFolders: number | null
}

export const FREE_LIMITS: Limits = { maxFiles: 2, maxFolders: 1 }
export const UNLIMITED: Limits = { maxFiles: null, maxFolders: null }

/**
 * An unpaid teacher can genuinely trial the product — run one real class,
 * build a small library — but not operate on it indefinitely for free.
 */
export const TEACHER_FREE_LIMITS: TeacherLimits = {
  maxClasses: 1,
  maxStudentsPerClass: 30,
  maxLibraryFiles: 5,
  maxLibraryFolders: 1,
}

export const TEACHER_UNLIMITED: TeacherLimits = {
  maxClasses: null,
  maxStudentsPerClass: null,
  maxLibraryFiles: null,
  maxLibraryFolders: null,
}

/** Stripe statuses that still grant access. */
export const ACTIVE_STATUSES = ["active", "trialing"] as const

/**
 * Only applied when Stripe itself could not be reached. A renewal webhook can
 * be missed, so a briefly stale period must not lock out someone who is really
 * paying — but the window is short enough that a genuinely cancelled plan
 * cannot coast on it.
 */
export const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000

type BillingRow = {
  status: string
  currentPeriodEnd: Date | null
  stripeSubscriptionId: string | null
}

/**
 * Decides whether a stored billing row still grants access.
 *
 * `status` alone is not enough: it only changes when a webhook arrives, so a
 * lapsed or cancelled plan can sit in the database marked "active" forever. If
 * the stored period has passed we re-read the subscription from Stripe and
 * judge the refreshed row instead.
 */
async function resolveLiveRow<T extends BillingRow>(
  row: T | undefined,
  reload: () => Promise<T | undefined>,
): Promise<T | null> {
  if (!row) return null
  if (!(ACTIVE_STATUSES as readonly string[]).includes(row.status)) return null

  const periodEnd = row.currentPeriodEnd
  if (!periodEnd) return row
  if (periodEnd.getTime() > Date.now()) return row

  // The period has lapsed, so this row is no longer evidence of anything.
  if (!row.stripeSubscriptionId) return null

  const refreshed = await refreshSubscriptionFromStripe(row.stripeSubscriptionId)
  if (!refreshed) {
    return periodEnd.getTime() + RENEWAL_GRACE_MS > Date.now() ? row : null
  }

  const fresh = await reload()
  if (!fresh) return null
  if (!(ACTIVE_STATUSES as readonly string[]).includes(fresh.status)) return null

  const freshEnd = fresh.currentPeriodEnd
  if (freshEnd && freshEnd.getTime() <= Date.now()) return null
  return fresh
}

/** Same judgement for callers holding a row they fetched themselves. */
export function isSubscriptionLive(
  status: string,
  currentPeriodEnd: Date | string | null,
): boolean {
  if (!(ACTIVE_STATUSES as readonly string[]).includes(status)) return false
  if (!currentPeriodEnd) return true
  const end =
    currentPeriodEnd instanceof Date ? currentPeriodEnd : new Date(currentPeriodEnd)
  return end.getTime() > Date.now()
}

export type Entitlement = {
  userId: string
  plan: EntitlementPlan
  source: EntitlementSource
  isPro: boolean
  limits: Limits
  /**
   * Teaching capability is separate from the student workspace quota. Buying
   * Student Pro must never unlock Teacher Pro features, so these limits are
   * driven by the plan tier, not merely by "has an active subscription".
   */
  isTeacher: boolean
  hasTeacherPro: boolean
  teacherLimits: TeacherLimits
  schoolId: number | null
  schoolRole: SchoolRole | null
  /** True when the user belongs to a school whose plan is not currently paid. */
  schoolUnpaid: boolean
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

/**
 * Resolve what a user is entitled to.
 *
 * Order matters and is deliberate:
 *   1. An active school plan wins. A school student must never be shown or
 *      charged for an individual upgrade.
 *   2. Otherwise an active individual subscription.
 *   3. Otherwise free tier.
 *
 * Wrapped in React `cache` so a single request resolves it once.
 */
export const getEntitlement = cache(async (userId: string): Promise<Entitlement> => {
  // Teaching capability has two independent sources: the global role chosen at
  // sign-up, and a teacher/admin seat inside a school. A school teacher who
  // signed up as a student must still be able to teach, and neither source is
  // allowed to be read straight off the session cookie.
  const [account] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const globalRole = account?.role === "teacher" ? "teacher" : "student"

  const base = {
    userId,
    schoolId: null as number | null,
    schoolRole: null as SchoolRole | null,
    schoolUnpaid: false,
    currentPeriodEnd: null as Date | null,
    cancelAtPeriodEnd: false,
  }

  // Membership first: we need it even when the school has not paid, so the UI
  // can explain why access is limited instead of silently downgrading.
  const [membership] = await db
    .select({
      schoolId: schoolMembers.schoolId,
      role: schoolMembers.role,
    })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.userId, userId), eq(schoolMembers.status, "active")))
    .limit(1)

  const schoolRole = (membership?.role as SchoolRole | undefined) ?? null
  const isTeacher =
    globalRole === "teacher" || schoolRole === "teacher" || schoolRole === "school_admin"

  const finalise = (
    fields: Pick<
      Entitlement,
      "plan" | "source" | "isPro" | "limits" | "currentPeriodEnd" | "cancelAtPeriodEnd"
    >,
  ): Entitlement => {
    const hasTeacherPro =
      isTeacher && (fields.plan === "school" || fields.plan === "teacher_pro")
    return {
      ...base,
      ...fields,
      isTeacher,
      hasTeacherPro,
      teacherLimits: hasTeacherPro ? TEACHER_UNLIMITED : TEACHER_FREE_LIMITS,
    }
  }

  if (membership) {
    base.schoolId = membership.schoolId
    base.schoolRole = schoolRole

    const readSchoolPlan = async () =>
      (
        await db
          .select()
          .from(schoolSubscriptions)
          .where(eq(schoolSubscriptions.schoolId, membership.schoolId))
          .limit(1)
      )[0]

    const schoolPlan = await resolveLiveRow(await readSchoolPlan(), readSchoolPlan)

    if (schoolPlan) {
      return finalise({
        plan: "school",
        source: "school",
        isPro: true,
        limits: UNLIMITED,
        currentPeriodEnd: schoolPlan.currentPeriodEnd,
        cancelAtPeriodEnd: schoolPlan.cancelAtPeriodEnd,
      })
    }

    base.schoolUnpaid = true
  }

  const readIndividual = async () =>
    (
      await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1)
    )[0]

  const individual = await resolveLiveRow(await readIndividual(), readIndividual)

  if (individual) {
    return finalise({
      plan: individual.plan === "teacher_pro" ? "teacher_pro" : "student_pro",
      source: "individual",
      isPro: true,
      limits: UNLIMITED,
      currentPeriodEnd: individual.currentPeriodEnd,
      cancelAtPeriodEnd: individual.cancelAtPeriodEnd,
    })
  }

  return finalise({
    plan: "free",
    source: "free",
    isPro: false,
    limits: FREE_LIMITS,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  })
})

export async function getCurrentEntitlement() {
  const me = await requireUser()
  return getEntitlement(me.id)
}

/**
 * Live usage counts. Never trust the denormalised counters on `user`: they were
 * only ever incremented, never decremented on delete, so a student who created
 * and deleted two files was permanently locked out.
 *
 * Teacher-assigned content does not count against a student's own quota. That
 * exemption is only safe because distribution into a personal workspace, and
 * distribution to yourself, are both blocked — otherwise a teacher-role account
 * could mint itself unlimited uncounted files.
 */
export const getUsage = cache(async (userId: string) => {
  const [[files], [folders]] = await Promise.all([
    db
      .select({ value: count() })
      .from(codeFiles)
      .where(
        and(eq(codeFiles.studentId, userId), eq(codeFiles.assignedByTeacher, false)),
      ),
    db
      .select({ value: count() })
      .from(studentFolders)
      .where(
        and(
          eq(studentFolders.studentId, userId),
          eq(studentFolders.assignedByTeacher, false),
        ),
      ),
  ])

  return { files: files?.value ?? 0, folders: folders?.value ?? 0 }
})

/** Teaching-side usage. Personal workspaces are infrastructure, not classes. */
export const getTeacherUsage = cache(async (userId: string) => {
  const [[classCount], [libFiles], [libFolders]] = await Promise.all([
    db
      .select({ value: count() })
      .from(classes)
      .where(and(eq(classes.teacherId, userId), eq(classes.isPersonal, false))),
    db.select({ value: count() }).from(libraryFiles).where(eq(libraryFiles.teacherId, userId)),
    db
      .select({ value: count() })
      .from(libraryFolders)
      .where(eq(libraryFolders.teacherId, userId)),
  ])

  return {
    classes: classCount?.value ?? 0,
    libraryFiles: libFiles?.value ?? 0,
    libraryFolders: libFolders?.value ?? 0,
  }
})

// ---------- Guards ----------

export type EntitlementCode =
  | "file_limit"
  | "folder_limit"
  | "class_limit"
  | "student_limit"
  | "library_file_limit"
  | "library_folder_limit"
  | "forbidden"

export class EntitlementError extends Error {
  code: EntitlementCode
  constructor(code: EntitlementCode, message: string) {
    super(message)
    this.name = "EntitlementError"
    this.code = code
  }
}

export async function assertCanCreateFile(userId: string) {
  const [entitlement, usage] = await Promise.all([
    getEntitlement(userId),
    getUsage(userId),
  ])
  const max = entitlement.limits.maxFiles
  if (max !== null && usage.files >= max) {
    throw new EntitlementError(
      "file_limit",
      `Free plan is limited to ${max} files. Upgrade to create more.`,
    )
  }
}

export async function assertCanCreateFolder(userId: string) {
  const [entitlement, usage] = await Promise.all([
    getEntitlement(userId),
    getUsage(userId),
  ])
  const max = entitlement.limits.maxFolders
  if (max !== null && usage.folders >= max) {
    throw new EntitlementError(
      "folder_limit",
      `Free plan is limited to ${max} folder. Upgrade to create more.`,
    )
  }
}

/**
 * The single authority on whether someone may act as a teacher. Callers must
 * use this instead of reading `role` off the session, which reflects only the
 * self-declared sign-up choice and ignores school membership.
 */
export async function requireTeacherCapability(userId: string) {
  const entitlement = await getEntitlement(userId)
  if (!entitlement.isTeacher) {
    throw new EntitlementError("forbidden", "Only teachers can do that")
  }
  return entitlement
}

export async function assertCanCreateClass(userId: string) {
  const entitlement = await requireTeacherCapability(userId)
  const max = entitlement.teacherLimits.maxClasses
  if (max === null) return

  const usage = await getTeacherUsage(userId)
  if (usage.classes >= max) {
    throw new EntitlementError(
      "class_limit",
      `The free teacher plan includes ${max} class. Upgrade to Teacher Pro to run more.`,
    )
  }
}

export async function assertCanCreateLibraryFile(userId: string) {
  const entitlement = await requireTeacherCapability(userId)
  const max = entitlement.teacherLimits.maxLibraryFiles
  if (max === null) return

  const usage = await getTeacherUsage(userId)
  if (usage.libraryFiles >= max) {
    throw new EntitlementError(
      "library_file_limit",
      `The free teacher plan includes ${max} library files. Upgrade to Teacher Pro for an unlimited library.`,
    )
  }
}

export async function assertCanCreateLibraryFolder(userId: string) {
  const entitlement = await requireTeacherCapability(userId)
  const max = entitlement.teacherLimits.maxLibraryFolders
  if (max === null) return

  const usage = await getTeacherUsage(userId)
  if (usage.libraryFolders >= max) {
    throw new EntitlementError(
      "library_folder_limit",
      `The free teacher plan includes ${max} library folder. Upgrade to Teacher Pro for more.`,
    )
  }
}

/**
 * Checked when a student joins, so the cap is enforced against the class
 * owner's plan rather than the joining student's.
 */
// NOTE: the class seat check lives inside joinClass, not here. It has to run in
// the same transaction as the enrolment insert and behind a row lock on the
// class, otherwise two pupils claiming the last seat can both pass the check
// before either writes. A standalone helper cannot offer that guarantee, so it
// was removed rather than left available to call.

export async function requireSchoolAdmin(schoolId?: number) {
  const me = await requireUser()
  const [membership] = await db
    .select()
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.userId, me.id),
        eq(schoolMembers.role, "school_admin"),
        eq(schoolMembers.status, "active"),
        ...(schoolId ? [eq(schoolMembers.schoolId, schoolId)] : []),
      ),
    )
    .limit(1)

  if (!membership) throw new EntitlementError("forbidden", "Not a school administrator")
  return { user: me, schoolId: membership.schoolId }
}

/** Prevents cross-tenant reads: both users must sit in the same school. */
export async function assertSameSchool(userIdA: string, userIdB: string) {
  const [a, b] = await Promise.all([getEntitlement(userIdA), getEntitlement(userIdB)])
  if (!a.schoolId || a.schoolId !== b.schoolId) {
    throw new EntitlementError("forbidden", "Users are not in the same school")
  }
}
