"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getSessionUser, requireUser } from "@/lib/session"
import { getEntitlement, getUsage, limitsFor } from "@/lib/entitlements"
import { getLanguage, toLanguageId, type LanguageId } from "@/lib/ide/languages"

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

export async function canCreateFile(
  languageInput: LanguageId = "python",
  userId?: string,
): Promise<boolean> {
  const me = await requireUser()
  // Callers may only ask about themselves.
  if (userId && userId !== me.id) throw new Error("Unauthorized")

  const language = toLanguageId(languageInput)
  const [entitlement, usage] = await Promise.all([
    getEntitlement(me.id),
    getUsage(me.id, language),
  ])
  const max = limitsFor(entitlement, language).maxFiles
  return max === null || usage.files < max
}

export async function canCreateFolder(
  languageInput: LanguageId = "python",
  userId?: string,
): Promise<boolean> {
  const me = await requireUser()
  if (userId && userId !== me.id) throw new Error("Unauthorized")

  const language = toLanguageId(languageInput)
  const [entitlement, usage] = await Promise.all([
    getEntitlement(me.id),
    getUsage(me.id, language),
  ])
  const max = limitsFor(entitlement, language).maxFolders
  return max === null || usage.folders < max
}

/**
 * Usage and limits for one IDE. The caller passes the IDE it is displaying, so
 * the tier bar always shows the same quota the server will enforce.
 */
export async function getUserSubscriptionInfo(languageInput: LanguageId = "python") {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error("Not authenticated")

  const language = toLanguageId(languageInput)
  const [entitlement, usage, [record]] = await Promise.all([
    getEntitlement(sessionUser.id),
    getUsage(sessionUser.id, language),
    db
      .select({ accountType: user.accountType, isFirstLogin: user.isFirstLogin })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1),
  ])

  const limits = limitsFor(entitlement, language)

  return {
    language,
    languageLabel: getLanguage(language).label,
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
    maxFiles: limits.maxFiles,
    maxFolders: limits.maxFolders,
    schoolId: entitlement.schoolId,
    schoolRole: entitlement.schoolRole,
    schoolUnpaid: entitlement.schoolUnpaid,
  }
}
