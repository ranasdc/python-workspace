import "server-only"

import { cache } from "react"
import { and, count, eq, gte, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  aiTaskUsage,
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
import { getLanguage, type LanguageId } from "@/lib/ide/languages"

// This module is the ONLY place allowed to decide what a user may do.
// Nothing reads user.accountType or user.subscriptionStatus to make a decision
// any more: those columns are cosmetic leftovers and are trivially forgeable
// through the onboarding action, so they carry no authority.

export type EntitlementPlan = "free" | "student_pro" | "teacher_pro" | "school"
export type EntitlementSource = "school" | "teacher" | "individual" | "free"
export type SchoolRole = "student" | "teacher" | "school_admin"

/**
 * The school roles that carry administrative authority.
 *
 * Every administrative check — invite codes, member removal, school billing —
 * resolves through this one list, so a new tier of administrator (a smaller
 * school's admin, or an MTA-level admin spanning several schools) is granted
 * those powers by being added here rather than by hunting down each call site.
 * Only "school_admin" exists today; it is never self-registerable.
 */
export const SCHOOL_ADMIN_ROLES = ["school_admin"] as const satisfies readonly SchoolRole[]

/** Whether this user may administer the school they belong to. */
export function isSchoolAdminRole(role: SchoolRole | null): boolean {
  return role !== null && (SCHOOL_ADMIN_ROLES as readonly string[]).includes(role)
}

/**
 * Who may create, limit, expire, disable and replace teacher invite codes.
 * The UI uses this to decide what to render; the server actions independently
 * re-check through `requireSchoolAdmin`, so hiding a button is never the only
 * thing standing between a user and the code.
 */
export function canManageInviteCodes(entitlement: Entitlement): boolean {
  return entitlement.schoolId !== null && isSchoolAdminRole(entitlement.schoolRole)
}

export type Limits = {
  /** null means unlimited. */
  maxFiles: number | null
  maxFolders: number | null
  /** How many files a single folder may hold. null means unlimited. */
  maxFilesPerFolder: number | null
}

export type TeacherLimits = {
  /** null means unlimited. Personal workspaces never count. */
  maxClasses: number | null
  maxStudentsPerClass: number | null
  maxLibraryFiles: number | null
  maxLibraryFolders: number | null
}

export const UNLIMITED: Limits = { maxFiles: null, maxFolders: null, maxFilesPerFolder: null }

/**
 * An unpaid teacher can genuinely trial the product — run one real class,
 * build a small library — but not operate on it indefinitely for free.
 */
export const TEACHER_FREE_LIMITS: TeacherLimits = {
  maxClasses: 1,
  maxStudentsPerClass: 25,
  maxLibraryFiles: 2,
  maxLibraryFolders: 2,
}

export const TEACHER_UNLIMITED: TeacherLimits = {
  maxClasses: null,
  maxStudentsPerClass: null,
  maxLibraryFiles: null,
  maxLibraryFolders: null,
}

/**
 * AI task generation policy, per plan.
 *
 * `enabled` gates the feature; `monthlyLimit` caps successful generations per
 * calendar month (null = unlimited). These are intentionally the ONLY place the
 * policy lives, so the numbers can be tuned later without touching feature
 * code. The paid tiers currently generate without a numeric cap; set a number
 * here to start enforcing one — usage is already metered, so enforcement turns
 * on the moment a limit is set. Attaching a task by hand is always free and
 * never touches this policy.
 */
export const AI_TASK_POLICY: Record<
  EntitlementPlan,
  { enabled: boolean; monthlyLimit: number | null }
> = {
  free: { enabled: false, monthlyLimit: 0 },
  student_pro: { enabled: false, monthlyLimit: 0 },
  teacher_pro: { enabled: true, monthlyLimit: null },
  school: { enabled: true, monthlyLimit: null },
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
  /**
   * Teaching capability is separate from the student workspace quota. Buying
   * Student Pro must never unlock Teacher Pro features, so these limits are
   * driven by the plan tier, not merely by "has an active subscription".
   */
  isTeacher: boolean
  hasTeacherPro: boolean
  teacherLimits: TeacherLimits
  /** Whether this plan may generate tasks with AI. Manual tasks are always allowed. */
  canGenerateAiTasks: boolean
  /** null = unlimited generations per month. */
  aiTaskMonthlyLimit: number | null
  schoolId: number | null
  schoolRole: SchoolRole | null
  /** True when the user belongs to a school whose plan is not currently paid. */
  schoolUnpaid: boolean
  /**
   * Name of the teacher whose Teacher Pro plan covers this pupil, or null.
   *
   * Set whenever such a teacher exists, not only when they are the winning
   * source, so a pupil paying for Student Pro can be told they are buying
   * access they already have.
   */
  coveredByTeacherName: string | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

/**
 * Pro reaching a pupil through the teacher who owns one of their classes.
 *
 * A teacher paying for Teacher Pro extends the student-side Pro features to
 * everyone they teach, exactly as a school plan does for its pupils. Only
 * `teacher_pro` carries this: a teacher who happens to hold Student Pro is
 * paying for their own workspace and covers nobody.
 *
 * The owner's billing row is read directly rather than by recursing into
 * `getEntitlement`, which could otherwise loop forever between two accounts
 * that had each joined the other's class.
 */
async function findCoveringTeacherPlan(studentId: string) {
  const candidates = await db
    .selectDistinct({
      teacherId: classes.teacherId,
      teacherName: user.name,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(subscriptions, eq(subscriptions.userId, classes.teacherId))
    .innerJoin(user, eq(user.id, classes.teacherId))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        // A personal workspace is the teacher's own sandbox rather than a
        // class they teach, so it passes coverage to nobody.
        eq(classes.isPersonal, false),
        eq(subscriptions.plan, "teacher_pro"),
        inArray(subscriptions.status, [...ACTIVE_STATUSES]),
      ),
    )

  // `status` can be stale, so each candidate still has to survive the same
  // liveness check an individual subscription gets.
  for (const candidate of candidates) {
    const live = await resolveLiveRow(candidate, async () => {
      const [fresh] = await db
        .select({
          teacherId: subscriptions.userId,
          teacherName: user.name,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        })
        .from(subscriptions)
        .innerJoin(user, eq(user.id, subscriptions.userId))
        .where(
          and(
            eq(subscriptions.userId, candidate.teacherId),
            eq(subscriptions.plan, "teacher_pro"),
          ),
        )
        .limit(1)
      return fresh
    })

    if (live) return live
  }

  return null
}

/**
 * Resolve what a user is entitled to.
 *
 * Order matters and is deliberate:
 *   1. An active school plan wins. A school student must never be shown or
 *      charged for an individual upgrade.
 *   2. Otherwise an active individual subscription. This outranks teacher
 *      coverage so that someone who pays keeps their own billing state on
 *      show, and keeps the ability to manage it.
 *   3. Otherwise cover inherited from a teacher on Teacher Pro.
 *   4. Otherwise free tier.
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
    coveredByTeacherName: null as string | null,
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
      "plan" | "source" | "isPro" | "currentPeriodEnd" | "cancelAtPeriodEnd"
    >,
  ): Entitlement => {
    const hasTeacherPro =
      isTeacher && (fields.plan === "school" || fields.plan === "teacher_pro")
    const aiPolicy = AI_TASK_POLICY[fields.plan]
    return {
      ...base,
      ...fields,
      isTeacher,
      hasTeacherPro,
      teacherLimits: hasTeacherPro ? TEACHER_UNLIMITED : TEACHER_FREE_LIMITS,
      canGenerateAiTasks: isTeacher && aiPolicy.enabled,
      aiTaskMonthlyLimit: aiPolicy.monthlyLimit,
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

  // Teacher coverage is resolved even when the pupil pays for themselves, so
  // the billing page can point out that they are buying what they already get.
  // Teaching accounts are skipped: they never enrol as pupils, and inherited
  // cover must not be able to reach the teacher-side limits.
  const [individualRow, covering] = await Promise.all([
    readIndividual(),
    isTeacher ? Promise.resolve(null) : findCoveringTeacherPlan(userId),
  ])

  base.coveredByTeacherName = covering?.teacherName ?? null

  const individual = await resolveLiveRow(individualRow, readIndividual)

  if (individual) {
    return finalise({
      plan: individual.plan === "teacher_pro" ? "teacher_pro" : "student_pro",
      source: "individual",
      isPro: true,
      currentPeriodEnd: individual.currentPeriodEnd,
      cancelAtPeriodEnd: individual.cancelAtPeriodEnd,
    })
  }

  if (covering) {
    return finalise({
      // Student-side Pro only. Deliberately not `teacher_pro`: that tier is
      // what lifts the teaching limits, and lending it to a pupil would hand
      // them the owner's unlimited classes and library.
      plan: "student_pro",
      source: "teacher",
      isPro: true,
      currentPeriodEnd: covering.currentPeriodEnd,
      cancelAtPeriodEnd: covering.cancelAtPeriodEnd,
    })
  }

  return finalise({
    plan: "free",
    source: "free",
    isPro: false,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  })
})

/**
 * Workspace quota for one IDE.
 *
 * Allowances are per-IDE by design: the free tier is meant to let a pupil try
 * each IDE properly, so opening HTML does not eat into the Python allowance.
 * Pro lifts every IDE at once.
 */
export function limitsFor(entitlement: Entitlement, language: LanguageId): Limits {
  if (entitlement.isPro) return UNLIMITED
  return getLanguage(language).freeLimits
}

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
export const getUsage = cache(async (userId: string, language: LanguageId) => {
  const [[files], [folders]] = await Promise.all([
    db
      .select({ value: count() })
      .from(codeFiles)
      .where(
        and(
          eq(codeFiles.studentId, userId),
          eq(codeFiles.assignedByTeacher, false),
          eq(codeFiles.language, language),
        ),
      ),
    db
      .select({ value: count() })
      .from(studentFolders)
      .where(
        and(
          eq(studentFolders.studentId, userId),
          eq(studentFolders.assignedByTeacher, false),
          eq(studentFolders.language, language),
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

/** First instant of the current calendar month, in the server's timezone. */
function startOfMonth(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

/**
 * AI generations used this month, counted against the account that actually
 * pays. A school teacher's usage is billed to the school so one teacher cannot
 * exhaust another's allowance and the cap applies to the whole institution;
 * an individual teacher is billed to themselves.
 */
export const getAiTaskUsageThisMonth = cache(async (entitlement: Entitlement) => {
  const since = startOfMonth()
  const where =
    entitlement.source === "school" && entitlement.schoolId !== null
      ? and(eq(aiTaskUsage.schoolId, entitlement.schoolId), gte(aiTaskUsage.createdAt, since))
      : and(eq(aiTaskUsage.teacherId, entitlement.userId), gte(aiTaskUsage.createdAt, since))

  const [row] = await db.select({ value: count() }).from(aiTaskUsage).where(where)
  return row?.value ?? 0
})

// ---------- Guards ----------

export type EntitlementCode =
  | "file_limit"
  | "folder_limit"
  | "class_limit"
  | "student_limit"
  | "library_file_limit"
  | "library_folder_limit"
  | "ai_not_available"
  | "ai_limit"
  | "forbidden"

export class EntitlementError extends Error {
  code: EntitlementCode
  constructor(code: EntitlementCode, message: string) {
    super(message)
    this.name = "EntitlementError"
    this.code = code
  }
}

export async function assertCanCreateFile(userId: string, language: LanguageId) {
  const [entitlement, usage] = await Promise.all([
    getEntitlement(userId),
    getUsage(userId, language),
  ])
  const max = limitsFor(entitlement, language).maxFiles
  if (max !== null && usage.files >= max) {
    throw new EntitlementError(
      "file_limit",
      `The free plan includes ${max} ${getLanguage(language).label} files. Upgrade to create more.`,
    )
  }
}

export async function assertCanCreateFolder(userId: string, language: LanguageId) {
  const [entitlement, usage] = await Promise.all([
    getEntitlement(userId),
    getUsage(userId, language),
  ])
  const max = limitsFor(entitlement, language).maxFolders
  if (max !== null && usage.folders >= max) {
    throw new EntitlementError(
      "folder_limit",
      `The free plan includes ${max} ${getLanguage(language).label} folder. Upgrade to create more.`,
    )
  }
}

/**
 * Caps how many files a free user may keep inside one folder. Teacher-assigned
 * files are exempt for the same reason they are exempt from the account quota:
 * distributed work must not count against the recipient's allowance.
 */
export async function assertCanAddFileToFolder(
  userId: string,
  language: LanguageId,
  folderId: number,
) {
  const entitlement = await getEntitlement(userId)
  const max = limitsFor(entitlement, language).maxFilesPerFolder
  if (max === null) return

  const [row] = await db
    .select({ value: count() })
    .from(codeFiles)
    .where(
      and(
        eq(codeFiles.folderId, folderId),
        eq(codeFiles.studentId, userId),
        eq(codeFiles.assignedByTeacher, false),
      ),
    )

  if ((row?.value ?? 0) >= max) {
    throw new EntitlementError(
      "file_limit",
      `The free plan allows ${max} file per folder. Upgrade to add more.`,
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
 * The AI teaching tools, for message purposes only.
 *
 * They deliberately share one gate and one allowance rather than each getting
 * their own entitlement flag: they are the same product promise, so a plan
 * that grants one grants all of them, and a new AI tool is covered the day it
 * is added. This list only decides what the refusal says.
 */
export type AiTeachingFeature = "task" | "refinement" | "solution" | "starter"

const AI_FEATURE_REFUSAL: Record<AiTeachingFeature, string> = {
  task: "AI task generation is a Teacher Pro feature. Upgrade to generate tasks with AI, or write the task yourself.",
  refinement:
    "Refining a task with AI is a Teacher Pro feature. Upgrade to use it — your task is safe and you can keep editing it by hand.",
  solution:
    "AI model solutions are a Teacher Pro feature. Upgrade to generate them, or write the solution yourself.",
  starter:
    "AI Daily Starters are a Teacher Pro feature. Upgrade to generate them, or write the questions yourself.",
}

/**
 * Gate for the AI teaching tools. Returns the resolved entitlement so the
 * caller can record usage against the same account this checked. Writing a
 * task or a solution by hand never calls this — only AI work is gated and
 * metered.
 */
export async function assertCanGenerateAiTask(
  userId: string,
  feature: AiTeachingFeature = "task",
) {
  const entitlement = await requireTeacherCapability(userId)

  if (!entitlement.canGenerateAiTasks) {
    throw new EntitlementError("ai_not_available", AI_FEATURE_REFUSAL[feature])
  }

  const limit = entitlement.aiTaskMonthlyLimit
  if (limit !== null) {
    const used = await getAiTaskUsageThisMonth(entitlement)
    if (used >= limit) {
      throw new EntitlementError(
        "ai_limit",
        `You have used all ${limit} AI task generations for this month. They reset at the start of next month.`,
      )
    }
  }

  return entitlement
}

/** Records one successful AI generation against the paying account. */
export async function recordAiTaskUsage(entitlement: Entitlement) {
  await db.insert(aiTaskUsage).values({
    teacherId: entitlement.userId,
    schoolId: entitlement.source === "school" ? entitlement.schoolId : null,
  })
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
        // Matched against the shared admin-role list rather than a single
        // literal, so every administrative action recognises the same roles.
        inArray(schoolMembers.role, [...SCHOOL_ADMIN_ROLES]),
        eq(schoolMembers.status, "active"),
        ...(schoolId ? [eq(schoolMembers.schoolId, schoolId)] : []),
      ),
    )
    .limit(1)

  if (!membership) throw new EntitlementError("forbidden", "Not a school administrator")
  return { user: me, schoolId: membership.schoolId }
}

/** Prevents cross-tenant reads: both users must sit in the same school. */
/**
 * Same-school check, for features that are scoped to a school rather than to
 * one owner — a school-admin report, for example.
 *
 * Deliberately NOT used by the teacher-facing reads in app/actions/files.ts.
 * Those match on `class.teacherId = <caller>`, which already denies School B a
 * School A class and additionally denies a colleague in the same school.
 * Swapping that ownership check for this helper would widen access, not narrow
 * it: every teacher in a school would gain access to every other teacher's
 * classes. Add it alongside an ownership check, never in place of one.
 */
export async function assertSameSchool(userIdA: string, userIdB: string) {
  const [a, b] = await Promise.all([getEntitlement(userIdA), getEntitlement(userIdB)])
  if (!a.schoolId || a.schoolId !== b.schoolId) {
    throw new EntitlementError("forbidden", "Users are not in the same school")
  }
}
