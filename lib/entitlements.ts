import "server-only"

import { cache } from "react"
import { and, count, eq, inArray, ne } from "drizzle-orm"

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

    const [schoolPlan] = await db
      .select()
      .from(schoolSubscriptions)
      .where(
        and(
          eq(schoolSubscriptions.schoolId, membership.schoolId),
          inArray(schoolSubscriptions.status, [...ACTIVE_STATUSES]),
        ),
      )
      .limit(1)

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

  const [individual] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...ACTIVE_STATUSES]),
      ),
    )
    .limit(1)

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
export async function assertClassHasSeat(classId: number, teacherId: string) {
  const entitlement = await getEntitlement(teacherId)
  const max = entitlement.teacherLimits.maxStudentsPerClass
  if (max === null) return

  const [row] = await db
    .select({ value: count() })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), ne(enrollments.studentId, teacherId)))

  if ((row?.value ?? 0) >= max) {
    throw new EntitlementError(
      "student_limit",
      "This class is full. Ask your teacher to upgrade to Teacher Pro for unlimited students.",
    )
  }
}

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
