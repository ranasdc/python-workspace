"use server"

import { db } from "@/lib/db"
import { fileTasks, libraryFiles, libraryFolders } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import {
  assertCanCreateLibraryFile,
  assertCanCreateLibraryFolder,
  requireTeacherCapability,
  EntitlementError,
  type EntitlementCode,
} from "@/lib/entitlements"
import { and, asc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  normaliseFileName,
  starterContentFor,
  toLanguageId,
  type LanguageId,
} from "@/lib/ide/languages"
import {
  buildFolderTree,
  canHoldSubfolder,
  folderDepth,
  FOLDER_DEPTH_MESSAGE,
} from "@/lib/ide/folder-tree"

// Capability comes from the entitlement engine, not from the session's `role`
// field: a school teacher who signed up as a student must still be able to
// teach, and the session value reflects only a self-declared sign-up choice.
async function requireTeacher() {
  const me = await requireUser()
  await requireTeacherCapability(me.id)
  return me
}

// ---------- Read ----------
export async function getLibrary(languageInput: LanguageId = "python") {
  const teacher = await requireTeacher()
  const language = toLanguageId(languageInput)

  const [folders, files] = await Promise.all([
    db
      .select()
      .from(libraryFolders)
      .where(
        and(
          eq(libraryFolders.teacherId, teacher.id),
          eq(libraryFolders.language, language),
        ),
      )
      .orderBy(asc(libraryFolders.name)),
    db
      .select()
      .from(libraryFiles)
      .where(
        and(eq(libraryFiles.teacherId, teacher.id), eq(libraryFiles.language, language)),
      )
      .orderBy(asc(libraryFiles.name)),
  ])

  // Which of these files carry a task, in one query, so the tree can badge
  // them without an extra round-trip per file.
  const fileIds = files.map((f) => f.id)
  const taskRows = fileIds.length
    ? await db
        .select({ libraryFileId: fileTasks.libraryFileId })
        .from(fileTasks)
        .where(inArray(fileTasks.libraryFileId, fileIds))
    : []
  const withTask = new Set(taskRows.map((r) => r.libraryFileId))
  const decorate = (f: (typeof files)[number]) => ({ ...f, hasTask: withTask.has(f.id) })

  // Files not inside any folder come back as `rootFiles`, at the library root.
  return buildFolderTree(folders, files.map(decorate))
}

// ---------- Folders ----------

// Entitlement failures (e.g. the free-tier library caps) are an expected
// outcome, not a crash, so they are RETURNED rather than thrown: a thrown
// Server Action error has its message redacted in production and reaches the
// client as a generic "Server Components render" digest, useless for prompting
// an upgrade. Returned values cross the boundary intact.
export type CreateLibraryFolderResult =
  | { ok: true; folder: typeof libraryFolders.$inferSelect }
  | { ok: false; code: EntitlementCode; message: string }

export async function createLibraryFolder(
  name: string,
  languageInput: LanguageId = "python",
  parentId: number | null = null,
): Promise<CreateLibraryFolderResult> {
  const teacher = await requireTeacher()
  const language = toLanguageId(languageInput)

  // A subfolder counts towards the same allowance as any other folder.
  try {
    await assertCanCreateLibraryFolder(teacher.id)
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, code: error.code, message: error.message }
    }
    throw error
  }

  const clean = name.trim()
  if (!clean) {
    return { ok: false, code: "forbidden", message: "Folder name is required" }
  }

  if (parentId !== null) {
    // Scoped to this teacher and IDE, so a parent that belongs to anyone or
    // anything else is simply not in the set.
    const owned = await db
      .select({
        id: libraryFolders.id,
        parentId: libraryFolders.parentId,
        name: libraryFolders.name,
      })
      .from(libraryFolders)
      .where(
        and(eq(libraryFolders.teacherId, teacher.id), eq(libraryFolders.language, language)),
      )
    const depth = folderDepth(owned, parentId)
    if (depth === 0) {
      return { ok: false, code: "forbidden", message: "Folder not found" }
    }
    if (!canHoldSubfolder(depth)) {
      return { ok: false, code: "forbidden", message: FOLDER_DEPTH_MESSAGE }
    }
  }

  const [created] = await db
    .insert(libraryFolders)
    .values({ teacherId: teacher.id, parentId, name: clean, language })
    .returning()

  revalidatePath("/teacher")
  return { ok: true, folder: created }
}

// ---------- Files ----------

export type CreateLibraryFileResult =
  | { ok: true; file: typeof libraryFiles.$inferSelect }
  | { ok: false; code: EntitlementCode; message: string }

export async function createLibraryFile(
  name: string,
  folderId: number | null,
  languageInput: LanguageId = "python",
): Promise<CreateLibraryFileResult> {
  const teacher = await requireTeacher()
  const language = toLanguageId(languageInput)

  try {
    await assertCanCreateLibraryFile(teacher.id)
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, code: error.code, message: error.message }
    }
    throw error
  }

  const normalised = normaliseFileName(name, language)
  if (!normalised.ok) {
    return { ok: false, code: "forbidden", message: normalised.error }
  }
  const clean = normalised.name

  // The folder must belong to this teacher and sit in the same IDE.
  if (folderId !== null) {
    const [folder] = await db
      .select()
      .from(libraryFolders)
      .where(
        and(
          eq(libraryFolders.id, folderId),
          eq(libraryFolders.teacherId, teacher.id),
          eq(libraryFolders.language, language),
        ),
      )
    if (!folder) {
      return { ok: false, code: "forbidden", message: "Folder not found" }
    }
  }

  const [created] = await db
    .insert(libraryFiles)
    .values({
      teacherId: teacher.id,
      folderId,
      name: clean,
      language,
      content: starterContentFor(clean),
    })
    .returning()

  revalidatePath("/teacher")
  return { ok: true, file: created }
}

export async function saveLibraryFile(fileId: number, content: string) {
  const teacher = await requireTeacher()
  await db
    .update(libraryFiles)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.teacherId, teacher.id)))
  return { ok: true }
}
