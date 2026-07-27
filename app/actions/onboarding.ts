"use server"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { eq } from "drizzle-orm"

export async function setAccountType(accountType: "class" | "individual") {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error("Not authenticated")

  await db
    .update(user)
    .set({
      accountType,
      isFirstLogin: false,
      subscriptionStatus: accountType === "individual" ? "free" : undefined,
    })
    .where(eq(user.id, sessionUser.id))
}

export async function incrementFileCount(userId: string) {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  })

  if (!currentUser) throw new Error("User not found")

  await db
    .update(user)
    .set({
      createdFilesCount: (currentUser.createdFilesCount || 0) + 1,
    })
    .where(eq(user.id, userId))
}

export async function incrementFolderCount(userId: string) {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  })

  if (!currentUser) throw new Error("User not found")

  await db
    .update(user)
    .set({
      createdFoldersCount: (currentUser.createdFoldersCount || 0) + 1,
    })
    .where(eq(user.id, userId))
}

export async function canCreateFile(userId: string): Promise<boolean> {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  })

  if (!currentUser) throw new Error("User not found")

  // If user is on class account or paid subscription, no limit
  if (
    currentUser.accountType === "class" ||
    currentUser.subscriptionStatus !== "free"
  ) {
    return true
  }

  // Free tier: max 2 Python files
  return (currentUser.createdFilesCount || 0) < 2
}

export async function canCreateFolder(userId: string): Promise<boolean> {
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, userId),
  })

  if (!currentUser) throw new Error("User not found")

  // If user is on class account or paid subscription, no limit
  if (
    currentUser.accountType === "class" ||
    currentUser.subscriptionStatus !== "free"
  ) {
    return true
  }

  // Free tier: max 1 folder
  return (currentUser.createdFoldersCount || 0) < 1
}

export async function getUserSubscriptionInfo() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error("Not authenticated")

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, sessionUser.id),
  })

  if (!currentUser) throw new Error("User not found")

  return {
    accountType: currentUser.accountType,
    subscriptionStatus: currentUser.subscriptionStatus,
    createdFilesCount: currentUser.createdFilesCount || 0,
    createdFoldersCount: currentUser.createdFoldersCount || 0,
    isFirstLogin: currentUser.isFirstLogin,
  }
}
