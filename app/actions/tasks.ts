"use server"

import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { codeFiles, fileTasks, libraryFiles, libraryFolders } from "@/lib/db/schema"
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

/**
 * The full row, including the solution. Only ever returned by a read that has
 * already proved the caller is the teacher who owns the file.
 */
export type LibraryTask = typeof fileTasks.$inferSelect

/** Who wrote the stored solution. */
export type SolutionSource = "ai" | "teacher" | "teacher_edited"

const SOLUTION_SOURCES: readonly string[] = ["ai", "teacher", "teacher_edited"]

export type TaskDraft = {
  title: string
  instructions: string
  topic?: string | null
  difficulty?: string | null
  yearGroup?: string | null
  learningObjective?: string | null
  origin?: "manual" | "ai"
  aiRefined?: boolean
  /**
   * Teacher-only. Leave undefined to keep whatever is stored; pass null to
   * clear it. The distinction matters because a save that only touches the
   * instructions must not silently drop the solution.
   */
  solution?: string | null
  solutionSource?: SolutionSource | null
  /** Snapshot of the task the solution was written for. See lib/tasks/solution-freshness.ts. */
  solutionFingerprint?: string | null
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

  // A solution is only written when the caller says something about it, so a
  // save from a surface that does not know about solutions leaves the stored
  // one intact. Passing null is the explicit way to remove it.
  const solutionFields =
    draft.solution === undefined
      ? {}
      : draft.solution === null || !draft.solution.trim()
        ? {
            solution: null,
            solutionSource: null,
            solutionFingerprint: null,
            solutionUpdatedAt: null,
          }
        : {
            solution: draft.solution.trim().slice(0, 20000),
            solutionSource:
              draft.solutionSource && SOLUTION_SOURCES.includes(draft.solutionSource)
                ? draft.solutionSource
                : "teacher",
            solutionFingerprint: draft.solutionFingerprint?.slice(0, 20000) ?? null,
            solutionUpdatedAt: new Date(),
          }

  const shared = {
    title: title.slice(0, 200),
    instructions: instructions.slice(0, 8000),
    topic: draft.topic?.trim() || null,
    difficulty: draft.difficulty?.trim() || null,
    yearGroup: draft.yearGroup?.trim() || null,
    learningObjective: draft.learningObjective?.trim() || null,
    origin: draft.origin === "ai" ? "ai" : "manual",
    aiRefined: draft.aiRefined ?? false,
    ...solutionFields,
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

/* ----------------------- Reuse across the classes ---------------------- */

export type ReusableTask = {
  id: number
  libraryFileId: number
  title: string
  preview: string
  fileName: string
  folderName: string | null
  language: string
  topic: string | null
  difficulty: string | null
  yearGroup: string | null
  hasSolution: boolean
}

/**
 * Every task this teacher has attached to a library file, so one can be copied
 * onto another file instead of being written again. A library file is the
 * thing a teacher hands to a class, so this is the whole back catalogue of
 * tasks they have ever set, whichever class received them.
 *
 * Scoped to `teacherId`, which is what makes it work for every teacher role at
 * once while keeping a colleague's library private. The instructions and the
 * solution are summarised in SQL rather than loaded: the list only has to be
 * browsable, and getTaskForReuse fetches the one that is chosen.
 */
export async function listReusableTasks(): Promise<ReusableTask[]> {
  const me = await requireUser()
  await requireTeacherCapability(me.id)

  return db
    .select({
      id: fileTasks.id,
      libraryFileId: fileTasks.libraryFileId,
      title: fileTasks.title,
      preview: sql<string>`left(${fileTasks.instructions}, 180)`,
      fileName: libraryFiles.name,
      folderName: libraryFolders.name,
      language: libraryFiles.language,
      topic: fileTasks.topic,
      difficulty: fileTasks.difficulty,
      yearGroup: fileTasks.yearGroup,
      hasSolution: sql<boolean>`coalesce(${fileTasks.solution}, '') <> ''`.mapWith(Boolean),
    })
    .from(fileTasks)
    .innerJoin(libraryFiles, eq(libraryFiles.id, fileTasks.libraryFileId))
    .leftJoin(libraryFolders, eq(libraryFolders.id, libraryFiles.folderId))
    .where(eq(fileTasks.teacherId, me.id))
    .orderBy(desc(fileTasks.updatedAt))
    .limit(200)
}

export type TaskReuseSource = {
  title: string
  instructions: string
  topic: string | null
  difficulty: string | null
  yearGroup: string | null
  learningObjective: string | null
  origin: string
  aiRefined: boolean
  solution: string | null
  solutionSource: string | null
  /** The IDE the source file belongs to, so a solution is only carried across when it still runs. */
  language: string
}

/** The copyable content of one of the teacher's own tasks. */
export async function getTaskForReuse(taskId: number): Promise<TaskReuseSource> {
  const me = await requireUser()
  await requireTeacherCapability(me.id)

  const [row] = await db
    .select({ task: fileTasks, language: libraryFiles.language })
    .from(fileTasks)
    .innerJoin(libraryFiles, eq(libraryFiles.id, fileTasks.libraryFileId))
    .where(and(eq(fileTasks.id, taskId), eq(fileTasks.teacherId, me.id)))
    .limit(1)
  if (!row) throw new EntitlementError("forbidden", "Task not found")

  const { task } = row
  return {
    title: task.title,
    instructions: task.instructions,
    topic: task.topic,
    difficulty: task.difficulty,
    yearGroup: task.yearGroup,
    learningObjective: task.learningObjective,
    origin: task.origin,
    aiRefined: task.aiRefined,
    solution: task.solution,
    solutionSource: task.solutionSource,
    language: row.language,
  }
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

  // Columns are listed rather than selecting the row and picking fields
  // afterwards: the solution and the AI bookkeeping are teacher-only, and this
  // way they are never loaded into a student request at all, so a future field
  // is private by default instead of private by remembering to omit it.
  const [task] = await db
    .select({
      title: fileTasks.title,
      instructions: fileTasks.instructions,
      topic: fileTasks.topic,
      difficulty: fileTasks.difficulty,
      yearGroup: fileTasks.yearGroup,
      learningObjective: fileTasks.learningObjective,
      version: fileTasks.version,
    })
    .from(fileTasks)
    .where(eq(fileTasks.libraryFileId, file.sourceLibraryFileId))
  return task ?? null
}
