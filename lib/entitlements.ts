import "server-only"

import { cache } from "react"
import { and, count, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  codeFiles,
  schoolMembers,
  schoolSubscriptions,
  studentFolders,
  subscriptions,
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

export const FREE_LIMITS: Limits = { maxFiles: 2, maxFolders: 1 }
export const UNLIMITED: Limits = { maxFiles: null, maxFolders: null }

/** Stripe statuses that still grant access. */
export const ACTIVE_STATUSES = ["active", "trialing"] as const

export type Entitlement = {
  userId: string
  plan: EntitlementPlan
  source: EntitlementSource
  isPro: boolean
  limits: Limits
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

  if (membership) {
    base.schoolId = membership.schoolId
    base.schoolRole = membership.role as SchoolRole

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
      return {
        ...base,
        plan: "school",
        source: "school",
        isPro: true,
        limits: UNLIMITED,
        currentPeriodEnd: schoolPlan.currentPeriodEnd,
        cancelAtPeriodEnd: schoolPlan.cancelAtPeriodEnd,
      }
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
    return {
      ...base,
      plan: individual.plan === "teacher_pro" ? "teacher_pro" : "student_pro",
      source: "individual",
      isPro: true,
      limits: UNLIMITED,
      currentPeriodEnd: individual.currentPeriodEnd,
      cancelAtPeriodEnd: individual.cancelAtPeriodEnd,
    }
  }

  return { ...base, plan: "free", source: "free", isPro: false, limits: FREE_LIMITS }
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
 * Teacher-assigned content does not count against a student's own quota.
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

// ---------- Guards ----------

export class EntitlementError extends Error {
  code: "file_limit" | "folder_limit" | "forbidden"
  constructor(code: EntitlementError["code"], message: string) {
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
