"use server"

import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { codeFiles, fileTasks, libraryFiles } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { requireTeacherCapability, EntitlementError } from "@/lib/entitlements"

// The read-only shape a student receives. Deliberately omits teacher-only
// bookkeeping (origin, teacherId) so a task can be shown without leaking how it
// was authored.
export type StudentTask = {
  title: string
  instructions: string
  topic: string | null
  difficulty: string | null
  yearGroup: string | null
  learningObjective: string | null
  version: number
}

export type LibraryTask = typeof fileTasks.$inferSelect

export type TaskDraft = {
  title: string
  instructions: string
  topic?: string | null
  difficulty?: string | null
  yearGroup?: string | null
  learningObjective?: string | null
  origin?: "manual" | "ai"
}

export type SaveTaskResult =
  | { ok: true; task: LibraryTask }
  | { ok: false; message: string }

/** Confirms the library file exists and belongs to the caller. */
async function requireOwnedLibraryFile(teacherId: string, libraryFileId: number) {
  const [file] = await db
    .select()
    .from(libraryFiles)
    .where(and(eq(libraryFiles.id, libraryFileId), eq(libraryFiles.teacherId, teacherId)))
  if (!file) throw new EntitlementError("forbidden", "Library file not found")
  return file
}

/** Teacher reads the task attached to one of their library files (may be null). */
export async function getLibraryTask(libraryFileId: number): Promise<LibraryTask | null> {
  const me = await requireUser()
  await requireTeacherCapability(me.id)
  await requireOwnedLibraryFile(me.id, libraryFileId)

  const [task] = await db
    .select()
    .from(fileTasks)
    .where(eq(fileTasks.libraryFileId, libraryFileId))
  return task ?? null
}

/**
 * Create or replace the task on a library file. One task per file: the unique
 * constraint on libraryFileId makes the upsert the only way to write, so a
 * second task can never be attached. Every save bumps the version so a
 * student's open copy can notice it changed.
 */
export async function saveLibraryTask(
  libraryFileId: number,
  draft: TaskDraft,
): Promise<SaveTaskResult> {
  const me = await requireUser()
  await requireTeacherCapability(me.id)
  await requireOwnedLibraryFile(me.id, libraryFileId)

  const title = draft.title.trim()
  const instructions = draft.instructions.trim()
  if (!title) return { ok: false, message: "A task needs a title." }
  if (!instructions) return { ok: false, message: "A task needs instructions." }

  const shared = {
    title: title.slice(0, 200),
    instructions: instructions.slice(0, 8000),
    topic: draft.topic?.trim() || null,
    difficulty: draft.difficulty?.trim() || null,
    yearGroup: draft.yearGroup?.trim() || null,
    learningObjective: draft.learningObjective?.trim() || null,
    origin: draft.origin === "ai" ? "ai" : "manual",
    updatedAt: new Date(),
  }

  const [task] = await db
    .insert(fileTasks)
    .values({ libraryFileId, teacherId: me.id, ...shared })
    .onConflictDoUpdate({
      target: fileTasks.libraryFileId,
      set: {
        ...shared,
        // Postgres exposes the would-be-inserted row as `excluded`; adding to
        // the current stored version increments it atomically.
        version: sql`${fileTasks.version} + 1`,
      },
    })
    .returning()

  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, task }
}

export async function deleteLibraryTask(libraryFileId: number) {
  const me = await requireUser()
  await requireTeacherCapability(me.id)
  await requireOwnedLibraryFile(me.id, libraryFileId)

  await db
    .delete(fileTasks)
    .where(and(eq(fileTasks.libraryFileId, libraryFileId), eq(fileTasks.teacherId, me.id)))
  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true }
}

/**
 * Student reads the task attached to one of their files. The task lives on the
 * teacher's library file; the student's copy points back at it through
 * sourceLibraryFileId, so this always returns the teacher's current text.
 * Ownership is enforced: a student may only read a task through a file that is
 * theirs.
 */
export async function getTaskForStudentFile(fileId: number): Promise<StudentTask | null> {
  const me = await requireUser()

  const [file] = await db
    .select()
    .from(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, me.id)))
  if (!file || file.sourceLibraryFileId === null) return null

  const [task] = await db
    .select()
    .from(fileTasks)
    .where(eq(fileTasks.libraryFileId, file.sourceLibraryFileId))
  if (!task) return null

  return {
    title: task.title,
    instructions: task.instructions,
    topic: task.topic,
    difficulty: task.difficulty,
    yearGroup: task.yearGroup,
    learningObjective: task.learningObjective,
    version: task.version,
  }
}
