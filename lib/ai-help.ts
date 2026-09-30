import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { aiHelpUnlocks, classes, codeFiles } from "@/lib/db/schema"
import { AccessError } from "@/lib/class-access"

export const DEFAULT_AI_HELP_DELAY_MINUTES = 10
export const MAX_AI_HELP_DELAY_MINUTES = 120

export function errorSignature(error: string) {
  return createHash("sha256").update(error.trim()).digest("hex")
}

/**
 * Resolves the AI Help policy for a student's file. The file must belong to
 * the caller, and the policy always comes from the file's class on the server.
 * Personal workspaces (individual students) have no teacher, so they keep the
 * default behaviour.
 */
export async function resolveAiHelpForFile(userId: string, fileId: number) {
  const [row] = await db
    .select({
      isPersonal: classes.isPersonal,
      aiHelpEnabled: classes.aiHelpEnabled,
      aiHelpDelayMinutes: classes.aiHelpDelayMinutes,
    })
    .from(codeFiles)
    .innerJoin(classes, eq(classes.id, codeFiles.classId))
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, userId)))
    .limit(1)
  if (!row) throw new AccessError("File not found.")

  if (row.isPersonal) {
    return { enabled: true, delayMinutes: DEFAULT_AI_HELP_DELAY_MINUTES }
  }
  return { enabled: row.aiHelpEnabled, delayMinutes: row.aiHelpDelayMinutes }
}

export async function findUnlock(userId: string, fileId: number, signature: string) {
  const [row] = await db
    .select()
    .from(aiHelpUnlocks)
    .where(
      and(
        eq(aiHelpUnlocks.studentId, userId),
        eq(aiHelpUnlocks.fileId, fileId),
        eq(aiHelpUnlocks.signature, signature),
      ),
    )
    .limit(1)
  return row ?? null
}

/** Idempotent: the first request fixes the unlock time; later calls reuse it. */
export async function createUnlock(
  userId: string,
  fileId: number,
  signature: string,
  delayMinutes: number,
) {
  const unlockAt = new Date(Date.now() + delayMinutes * 60 * 1000)
  await db
    .insert(aiHelpUnlocks)
    .values({ studentId: userId, fileId, signature, unlockAt })
    .onConflictDoNothing()
  return findUnlock(userId, fileId, signature)
}
