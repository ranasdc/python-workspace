"use server"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { codeFiles, fileShares, libraryFiles } from "@/lib/db/schema"
import { rateLimit } from "@/lib/rate-limit"
import { requireUser } from "@/lib/session"
import { createShareToken, isShareSourceKind, type ShareSourceKind } from "@/lib/shares"

export type ShareTarget = {
  kind: ShareSourceKind
  fileId: number
}

export type ShareResult =
  | { ok: true; token: string | null }
  | { ok: false; message: string }

/**
 * Publishing is restricted to the person who owns the file, and ownership is
 * read from the file's own row rather than inferred from a role.
 *
 * This is why a teacher cannot publish a pupil's work from the review view:
 * making a child's file world-readable is the child's call, not something that
 * should happen from someone else's toolbar. A teacher who wants to publish an
 * exemplar copies it into their library first, where they are the owner.
 */
async function ownsFile(kind: ShareSourceKind, fileId: number, userId: string) {
  if (kind === "library") {
    const [row] = await db
      .select({ id: libraryFiles.id })
      .from(libraryFiles)
      .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.teacherId, userId)))
      .limit(1)
    return Boolean(row)
  }

  const [row] = await db
    .select({ id: codeFiles.id })
    .from(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, userId)))
    .limit(1)
  return Boolean(row)
}

function readTarget(target: ShareTarget) {
  if (!isShareSourceKind(target?.kind)) return null
  const fileId = Number(target.fileId)
  if (!Number.isInteger(fileId) || fileId <= 0) return null
  return { kind: target.kind, fileId }
}

/**
 * The current link for a file, or null when it is not published.
 *
 * Read when the share menu opens so the menu can offer "stop sharing" for an
 * already-public file instead of silently handing back the same link again.
 */
export async function getFileShare(target: ShareTarget): Promise<ShareResult> {
  const me = await requireUser()
  const parsed = readTarget(target)
  if (!parsed) return { ok: false, message: "That file can't be shared." }

  if (!(await ownsFile(parsed.kind, parsed.fileId, me.id))) {
    return { ok: false, message: "That file can't be shared." }
  }

  const [row] = await db
    .select({ token: fileShares.token })
    .from(fileShares)
    .where(
      and(
        eq(fileShares.sourceKind, parsed.kind),
        eq(fileShares.sourceFileId, parsed.fileId),
        isNull(fileShares.revokedAt),
      ),
    )
    .limit(1)

  return { ok: true, token: row?.token ?? null }
}

/**
 * Publish a file to a public link, or return the link it already has.
 *
 * The insert upserts on (sourceKind, sourceFileId), which covers both of the
 * states that are not "brand new" in a single statement: a file that is already
 * published keeps its token, and one that was revoked is simply un-revoked. The
 * token never changes, so a link handed out months ago keeps working and a
 * later revoke still kills every copy of it.
 */
export async function publishFile(target: ShareTarget): Promise<ShareResult> {
  const me = await requireUser()
  const parsed = readTarget(target)
  if (!parsed) return { ok: false, message: "That file can't be shared." }

  if (!(await ownsFile(parsed.kind, parsed.fileId, me.id))) {
    return { ok: false, message: "That file can't be shared." }
  }

  // A human shares a handful of files; this only exists to stop a script
  // turning the product into free public file hosting.
  const limit = rateLimit(`publish:${me.id}`, 30, 60_000)
  if (!limit.ok) {
    return { ok: false, message: "Too many share links at once. Try again in a minute." }
  }

  const [row] = await db
    .insert(fileShares)
    .values({
      token: createShareToken(),
      sourceKind: parsed.kind,
      sourceFileId: parsed.fileId,
      ownerId: me.id,
    })
    .onConflictDoUpdate({
      target: [fileShares.sourceKind, fileShares.sourceFileId],
      set: { revokedAt: null, updatedAt: new Date() },
    })
    .returning({ token: fileShares.token })

  if (!row) return { ok: false, message: "Couldn't create a link. Try again." }
  return { ok: true, token: row.token }
}

/**
 * Withdraw the public link. The row survives with `revokedAt` set, so the file
 * can be re-published later on the same token — but until then every copy of
 * the link 404s.
 */
export async function unpublishFile(target: ShareTarget): Promise<ShareResult> {
  const me = await requireUser()
  const parsed = readTarget(target)
  if (!parsed) return { ok: false, message: "That file can't be shared." }

  await db
    .update(fileShares)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(fileShares.sourceKind, parsed.kind),
        eq(fileShares.sourceFileId, parsed.fileId),
        // Scoped to the owner rather than checked beforehand: the file may have
        // been deleted since it was shared, and its author must still be able
        // to pull the link.
        eq(fileShares.ownerId, me.id),
      ),
    )

  return { ok: true, token: null }
}
