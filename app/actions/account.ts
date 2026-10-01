"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { getAccountProfile } from "@/lib/account"

/** The profile of the signed-in user, for the account area. */
export async function getMyAccount() {
  const me = await requireUser()
  return getAccountProfile(me.id)
}

export type UpdateNameResult = { ok: true; name: string } | { ok: false; message: string }

/**
 * Change your own display name.
 *
 * Scoped to the session user with no id accepted from the client, so this can
 * only ever rename the caller. Everything else about the account — role,
 * school membership, plan — is set by the systems that own it and is not
 * editable here.
 */
export async function updateDisplayName(formData: FormData): Promise<UpdateNameResult> {
  const me = await requireUser()
  const name = String(formData.get("name") ?? "")
    .replace(/\s+/g, " ")
    .trim()

  if (name.length < 2) return { ok: false, message: "Your name needs at least 2 characters" }
  if (name.length > 80) return { ok: false, message: "Your name can be at most 80 characters" }

  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, me.id))

  revalidatePath("/account")
  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, name }
}
