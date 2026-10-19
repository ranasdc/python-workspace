import "server-only"

import { randomBytes } from "node:crypto"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { codeFiles, fileShares, libraryFiles } from "@/lib/db/schema"
import { collectAssociatedFiles, type PreviewFile } from "@/lib/ide/html-document"
import { isLanguageId, type LanguageId } from "@/lib/ide/languages"

/** Which table a share's `sourceFileId` points into. */
export type ShareSourceKind = "code" | "library"

export function isShareSourceKind(value: unknown): value is ShareSourceKind {
  return value === "code" || value === "library"
}

/**
 * 128 bits of randomness, base64url-encoded into 22 characters.
 *
 * The token *is* the access control, so it has to be unguessable. Anything
 * shorter or derived from the row (a serial id, a six-character code) would let
 * someone enumerate every shared file in the product.
 */
export function createShareToken() {
  return randomBytes(16).toString("base64url")
}

export type PublicShare = {
  token: string
  /** The shared file's own name, which is what the page is titled after. */
  fileName: string
  language: LanguageId
  /**
   * The shared file first, then only the sibling files it actually links to.
   * A page without its stylesheet is not the page the author shared, so the
   * siblings travel with it — the same bundle the Download action produces.
   */
  bundle: PreviewFile[]
  /** When the file was last saved, so the page can date what it is showing. */
  updatedAt: Date
}

/**
 * Resolve a public token to the file it points at.
 *
 * Deliberately takes no session and performs no ownership check: that is what
 * makes the link public. Everything it returns is content the author chose to
 * publish — never the owner's name, never a teacher's attached task or model
 * solution, both of which live in other tables that are simply not read here.
 *
 * Returns null for an unknown, revoked, or since-deleted target, all of which
 * the page turns into a 404 rather than distinguishing: telling an unknown
 * token apart from a revoked one leaks whether a link ever existed.
 */
export async function loadPublicShare(token: string): Promise<PublicShare | null> {
  // Cheap guard before touching the database. A real token is 22 characters.
  if (!token || token.length > 64) return null

  const [share] = await db
    .select({
      token: fileShares.token,
      sourceKind: fileShares.sourceKind,
      sourceFileId: fileShares.sourceFileId,
    })
    .from(fileShares)
    .where(and(eq(fileShares.token, token), isNull(fileShares.revokedAt)))
    .limit(1)

  if (!share) return null

  const source =
    share.sourceKind === "library"
      ? await loadLibrarySource(share.sourceFileId)
      : await loadCodeSource(share.sourceFileId)

  if (!source) return null
  // A 404 rather than a thrown 500 if a row ever carries a language this build
  // no longer ships: the page is public, so it should fail quietly.
  if (!isLanguageId(source.language)) return null

  return {
    token: share.token,
    fileName: source.name,
    language: source.language,
    bundle: collectAssociatedFiles(source.siblings, source.name),
    updatedAt: source.updatedAt,
  }
}

type LoadedSource = {
  name: string
  language: string
  updatedAt: Date
  /** Every file in the same folder, including the shared one itself. */
  siblings: PreviewFile[]
}

/** A pupil's own file, plus the files sitting beside it in the same folder. */
async function loadCodeSource(fileId: number): Promise<LoadedSource | null> {
  const [file] = await db
    .select({
      name: codeFiles.name,
      language: codeFiles.language,
      updatedAt: codeFiles.updatedAt,
      classId: codeFiles.classId,
      studentId: codeFiles.studentId,
      folderId: codeFiles.folderId,
    })
    .from(codeFiles)
    .where(eq(codeFiles.id, fileId))
    .limit(1)

  if (!file) return null

  const siblings = await db
    .select({ name: codeFiles.name, content: codeFiles.content })
    .from(codeFiles)
    .where(
      and(
        eq(codeFiles.classId, file.classId),
        eq(codeFiles.studentId, file.studentId),
        eq(codeFiles.language, file.language),
        // A null folderId means the class root, which `eq` cannot express.
        file.folderId === null
          ? isNull(codeFiles.folderId)
          : eq(codeFiles.folderId, file.folderId),
      ),
    )

  return { name: file.name, language: file.language, updatedAt: file.updatedAt, siblings }
}

/** A teacher's library file. The attached task and solution are never read. */
async function loadLibrarySource(fileId: number): Promise<LoadedSource | null> {
  const [file] = await db
    .select({
      name: libraryFiles.name,
      language: libraryFiles.language,
      updatedAt: libraryFiles.updatedAt,
      teacherId: libraryFiles.teacherId,
      folderId: libraryFiles.folderId,
    })
    .from(libraryFiles)
    .where(eq(libraryFiles.id, fileId))
    .limit(1)

  if (!file) return null

  const siblings = await db
    .select({ name: libraryFiles.name, content: libraryFiles.content })
    .from(libraryFiles)
    .where(
      and(
        eq(libraryFiles.teacherId, file.teacherId),
        eq(libraryFiles.language, file.language),
        file.folderId === null
          ? isNull(libraryFiles.folderId)
          : eq(libraryFiles.folderId, file.folderId),
      ),
    )

  return { name: file.name, language: file.language, updatedAt: file.updatedAt, siblings }
}
