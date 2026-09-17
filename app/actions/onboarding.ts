"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getSessionUser, requireUser } from "@/lib/session"
import { getEntitlement, getUsage } from "@/lib/entitlements"

/**
 * Records the student's onboarding choice.
 *
 * This used to be an authorization decision: passing "class" made
 * `canCreateFile` return true unconditionally, so any student could unlock the
 * paid tier with a single action call. `accountType` is now nothing more than a
 * UI preference — entitlements come from `lib/entitlements.ts` alone.
 */
export async function setAccountType(accountType: "class" | "individual") {
  const sessionUser = await requireUser()
  if (accountType !== "class" && accountType !== "individual") {
    throw new Error("Invalid account type")
  }

  await db
    .update(user)
    .set({ accountType, isFirstLogin: false })
    .where(eq(user.id, sessionUser.id))
}

export async function canCreateFile(userId?: string): Promise<boolean> {
  const me = await requireUser()
  // Callers may only ask about themselves.
  if (userId && userId !== me.id) throw new Error("Unauthorized")

  const [entitlement, usage] = await Promise.all([getEntitlement(me.id), getUsage(me.id)])
  const max = entitlement.limits.maxFiles
  return max === null || usage.files < max
}

export async function canCreateFolder(userId?: string): Promise<boolean> {
  const me = await requireUser()
  if (userId && userId !== me.id) throw new Error("Unauthorized")

  const [entitlement, usage] = await Promise.all([getEntitlement(me.id), getUsage(me.id)])
  const max = entitlement.limits.maxFolders
  return max === null || usage.folders < max
}

export async function getUserSubscriptionInfo() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error("Not authenticated")

  const [entitlement, usage, [record]] = await Promise.all([
    getEntitlement(sessionUser.id),
    getUsage(sessionUser.id),
    db
      .select({ accountType: user.accountType, isFirstLogin: user.isFirstLogin })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1),
  ])

  return {
    // Cosmetic fields, kept so existing UI keeps working.
    accountType: record?.accountType ?? null,
    isFirstLogin: record?.isFirstLogin ?? true,
    subscriptionStatus: entitlement.isPro ? "active" : "free",

    // Live counts, not drifting counters.
    createdFilesCount: usage.files,
    createdFoldersCount: usage.folders,

    // The authoritative view.
    plan: entitlement.plan,
    source: entitlement.source,
    isPro: entitlement.isPro,
    maxFiles: entitlement.limits.maxFiles,
    maxFolders: entitlement.limits.maxFolders,
    schoolId: entitlement.schoolId,
    schoolRole: entitlement.schoolRole,
    schoolUnpaid: entitlement.schoolUnpaid,
  }
}
