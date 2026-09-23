"use server"

import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { DEFAULT_LANGUAGE, isLanguageId, type LanguageId } from "@/lib/ide/languages"

/**
 * Remember which IDE the user last had open so their next visit resumes there.
 *
 * Purely a convenience: this value grants nothing, and a bad one falls back to
 * the default rather than failing the page load.
 */
export async function setLastIde(language: LanguageId) {
  const me = await requireUser()
  if (!isLanguageId(language)) throw new Error("Unknown IDE")

  await db.update(user).set({ lastIde: language }).where(eq(user.id, me.id))
  return { ok: true }
}

/** Resolve the IDE a page should open in. Never throws on stale data. */
export async function getLastIde(): Promise<LanguageId> {
  const me = await requireUser()
  const [row] = await db
    .select({ lastIde: user.lastIde })
    .from(user)
    .where(eq(user.id, me.id))
    .limit(1)

  return isLanguageId(row?.lastIde) ? row.lastIde : DEFAULT_LANGUAGE
}
