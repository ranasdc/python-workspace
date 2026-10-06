"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { isSelectableAvatarId, resolveAvatar } from "@/lib/avatars"

export type SetAvatarResult =
  | { ok: true; avatarId: string }
  | { ok: false; message: string }

/**
 * Choose your own profile avatar.
 *
 * Two things make this safe. The row is addressed by the session user with no
 * id accepted from the client, so it can only ever change the caller's own
 * picture; and the submitted value is checked against the server's catalogue
 * before it is written, so the column can only ever hold a key the product
 * recognises. A URL, a path, a retired avatar or anything else is rejected
 * outright and the existing choice is left exactly as it was.
 */
export async function setMyAvatar(avatarId: unknown): Promise<SetAvatarResult> {
  const me = await requireUser()

  if (!isSelectableAvatarId(avatarId)) {
    return { ok: false, message: "That avatar isn't part of the MyCodePad collection" }
  }

  await db
    .update(user)
    .set({ avatarId, updatedAt: new Date() })
    .where(eq(user.id, me.id))

  // Every surface that renders a person: the header follows the page it sits
  // on, so the workspaces are refreshed alongside the account area.
  revalidatePath("/account")
  revalidatePath("/teacher")
  revalidatePath("/student")
  revalidatePath("/school")

  return { ok: true, avatarId }
}

/** The caller's current avatar, already resolved to a real image. */
export async function getMyAvatar() {
  const me = await requireUser()
  const [record] = await db
    .select({ avatarId: user.avatarId })
    .from(user)
    .where(eq(user.id, me.id))
    .limit(1)

  return resolveAvatar(me.id, record?.avatarId)
}
