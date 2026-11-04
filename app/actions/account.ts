"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { getAccountProfile } from "@/lib/account"
import { composeDisplayName, normalizeName, validateName } from "@/lib/validation/account"

/** The profile of the signed-in user, for the account area. */
export async function getMyAccount() {
  const me = await requireUser()
  return getAccountProfile(me.id)
}

export type UpdateNameResult =
  | { ok: true; name: string }
  | { ok: false; message: string; field?: "firstName" | "lastName" }

/**
 * Change your own name.
 *
 * Scoped to the session user with no id accepted from the client, so this can
 * only ever rename the caller. Everything else about the account — role,
 * school membership, plan — is set by the systems that own it and is not
 * editable here.
 *
 * This is the only path that writes a name. Better Auth's own update endpoint
 * has the name fields stripped from it (see lib/auth.ts), so the two parts and
 * the display name composed from them are always written together and cannot
 * drift apart.
 */
export async function updateDisplayName(formData: FormData): Promise<UpdateNameResult> {
  const me = await requireUser()
  const firstRaw = String(formData.get("firstName") ?? "")
  const lastRaw = String(formData.get("lastName") ?? "")

  const firstProblem = validateName(firstRaw, "first")
  if (firstProblem) return { ok: false, message: firstProblem, field: "firstName" }
  const lastProblem = validateName(lastRaw, "last")
  if (lastProblem) return { ok: false, message: lastProblem, field: "lastName" }

  const firstName = normalizeName(firstRaw)
  const lastName = normalizeName(lastRaw)
  const name = composeDisplayName(firstName, lastName)

  await db
    .update(user)
    .set({ firstName, lastName, name, updatedAt: new Date() })
    .where(eq(user.id, me.id))

  revalidatePath("/account")
  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, name }
}
