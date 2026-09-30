"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { classes } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { assertTeacherOwnsClass } from "@/lib/class-access"
import {
  MAX_AI_HELP_DELAY_MINUTES,
  createUnlock,
  errorSignature,
  findUnlock,
  resolveAiHelpForFile,
} from "@/lib/ai-help"

export type AiHelpState = {
  enabled: boolean
  delayMinutes: number
  unlockAt: number | null
  serverNow: number
}

export async function getClassAiHelp(classId: number) {
  const user = await requireUser()
  const cls = await assertTeacherOwnsClass(user.id, classId)
  return { enabled: cls.aiHelpEnabled, delayMinutes: cls.aiHelpDelayMinutes }
}

export async function updateClassAiHelp(
  classId: number,
  settings: { enabled: boolean; delayMinutes: number },
) {
  const user = await requireUser()
  await assertTeacherOwnsClass(user.id, classId)

  const delay = Math.round(Number(settings.delayMinutes))
  if (!Number.isFinite(delay) || delay < 0 || delay > MAX_AI_HELP_DELAY_MINUTES) {
    throw new Error(`Unlock time must be between 0 and ${MAX_AI_HELP_DELAY_MINUTES} minutes.`)
  }

  await db
    .update(classes)
    .set({ aiHelpEnabled: Boolean(settings.enabled), aiHelpDelayMinutes: delay })
    .where(eq(classes.id, classId))

  return { enabled: Boolean(settings.enabled), delayMinutes: delay }
}

export async function getAiHelpState(fileId: number, error: string): Promise<AiHelpState> {
  const user = await requireUser()
  const policy = await resolveAiHelpForFile(user.id, fileId)
  const unlock = policy.enabled ? await findUnlock(user.id, fileId, errorSignature(error)) : null
  return {
    ...policy,
    unlockAt: unlock ? unlock.unlockAt.getTime() : null,
    serverNow: Date.now(),
  }
}

export async function requestAiHelpUnlock(fileId: number, error: string): Promise<AiHelpState> {
  const user = await requireUser()
  const policy = await resolveAiHelpForFile(user.id, fileId)
  if (!policy.enabled) {
    return { ...policy, unlockAt: null, serverNow: Date.now() }
  }
  const unlock = await createUnlock(user.id, fileId, errorSignature(error), policy.delayMinutes)
  return {
    ...policy,
    unlockAt: unlock ? unlock.unlockAt.getTime() : null,
    serverNow: Date.now(),
  }
}
