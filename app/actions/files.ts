"use server"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  fileComments,
  fileTasks,
  studentFolders,
  user,
} from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import {
  assertCanAddFileToFolder,
  assertCanCreateFile,
  assertCanCreateFolder,
  requireTeacherCapability,
} from "@/lib/entitlements"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  normaliseFileName,
  starterContentFor,
  toLanguageId,
  type LanguageId,
} from "@/lib/ide/languages"

async function assertEnrolled(studentId: string, classId: number) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId)))
  if (!row) throw new Error("You are not enrolled in this class")
}

// ---------- Student: manage own files & folders ----------
/**
 * Every student-facing read is scoped to one IDE. The language filter is
 * applied in SQL rather than in the client, so switching IDE cannot leak the
 * other IDE's tree even momentarily.
 */
export async function getStudentFiles(classId: number, languageInput: LanguageId) {
  const student = await requireUser()
  const language = toLanguageId(languageInput)
  await assertEnrolled(student.id, classId)

  const [folders, files] = await Promise.all([
    db
      .select()
      .from(studentFolders)
      .where(
        and(
          eq(studentFolders.classId, classId),
          eq(studentFolders.studentId, student.id),
          eq(studentFolders.language, language),
        ),
      )
      .orderBy(asc(studentFolders.name)),
    db
      .select()
      .from(codeFiles)
      .where(
        and(
          eq(codeFiles.classId, classId),
          eq(codeFiles.studentId, student.id),
          eq(codeFiles.language, language),
        ),
      )
      .orderBy(asc(codeFiles.name)),
  ])

  // A file carries a task only if it was assigned from a library file that has
  // one. Resolve that in a single query so each file can show a "View task"
  // affordance without a per-file round-trip.
  const sourceIds = Array.from(
    new Set(files.map((f) => f.sourceLibraryFileId).filter((id): id is number => id !== null)),
  )
  const taskRows = sourceIds.length
    ? await db
        .select({
          libraryFileId: fileTasks.libraryFileId,
          title: fileTasks.title,
          instructions: fileTasks.instructions,
        })
        .from(fileTasks)
        .where(inArray(fileTasks.libraryFileId, sourceIds))
    : []
  const taskBySource = new Map(taskRows.map((r) => [r.libraryFileId, r]))
  const decorate = (f: (typeof files)[number]) => {
    const task = f.sourceLibraryFileId !== null ? taskBySource.get(f.sourceLibraryFileId) : undefined
    return {
      ...f,
      hasTask: Boolean(task),
      taskTitle: task?.title ?? null,
      taskInstructions: task?.instructions ?? null,
    }
  }

  return {
    folders: folders.map((folder) => ({
      ...folder,
      files: files.filter((f) => f.folderId === folder.id).map(decorate),
    })),
    // Files not inside any folder live at the class root.
    rootFiles: files.filter((f) => f.folderId === null).map(decorate),
  }
}

export async function createFile(
  classId: number,
  name: string,
  folderId: number | null = null,
  languageInput: LanguageId = "python",
) {
  const student = await requireUser()
  const language = toLanguageId(languageInput)
  await assertEnrolled(student.id, classId)

  // Enforced here, on the server, before anything is written. The UI hint is a
  // convenience; this is the actual limit. Quota is per IDE.
  await assertCanCreateFile(student.id, language)

  // Rejects an extension belonging to another IDE, so the stored `language`
  // column and the file's actual type can never disagree.
  const normalised = normaliseFileName(name, language)
  if (!normalised.ok) throw new Error(normalised.error)
  const clean = normalised.name

  // A provided folder must belong to this student, in this class, in this IDE.
  if (folderId !== null) {
    const [folder] = await db
      .select()
      .from(studentFolders)
      .where(
        and(
          eq(studentFolders.id, folderId),
          eq(studentFolders.studentId, student.id),
          eq(studentFolders.classId, classId),
          eq(studentFolders.language, language),
        ),
      )
    if (!folder) throw new Error("Folder not found")

    // A folder has its own free-tier ceiling on top of the per-IDE file cap.
    await assertCanAddFileToFolder(student.id, language, folderId)
  }

  const [created] = await db
    .insert(codeFiles)
    .values({
      classId,
      studentId: student.id,
      folderId,
      name: clean,
      language,
      content: starterContentFor(clean),
    })
    .returning()

  revalidatePath("/student")
  return created
}

export async function createStudentFolder(
  classId: number,
  name: string,
  languageInput: LanguageId = "python",
) {
  const student = await requireUser()
  const language = toLanguageId(languageInput)
  await assertEnrolled(student.id, classId)

  await assertCanCreateFolder(student.id, language)

  const clean = name.trim()
  if (!clean) throw new Error("Enter a folder name")

  const [created] = await db
    .insert(studentFolders)
    .values({ classId, studentId: student.id, name: clean, language })
    .returning()

  revalidatePath("/student")
  return created
}

// Delete a folder and every file inside it (scoped to this student).
export async function deleteStudentFolder(folderId: number) {
  const student = await requireUser()

  const [folder] = await db
    .select()
    .from(studentFolders)
    .where(and(eq(studentFolders.id, folderId), eq(studentFolders.studentId, student.id)))
  if (!folder) throw new Error("Folder not found")

  // Work handed down by a teacher belongs to the assignment, not the student,
  // so it can never be removed from the student side.
  if (folder.assignedByTeacher) {
    throw new Error("This folder was assigned by your teacher and can't be deleted.")
  }

  await db
    .delete(codeFiles)
    .where(and(eq(codeFiles.folderId, folderId), eq(codeFiles.studentId, student.id)))
  await db
    .delete(studentFolders)
    .where(and(eq(studentFolders.id, folderId), eq(studentFolders.studentId, student.id)))
  revalidatePath("/student")
  return { ok: true }
}

export async function saveFile(fileId: number, content: string) {
  const student = await requireUser()
  const [file] = await db
    .select()
    .from(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, student.id)))
  if (!file) throw new Error("File not found")

  await db
    .update(codeFiles)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, student.id)))

  return { ok: true }
}

export async function deleteFile(fileId: number) {
  const student = await requireUser()

  const [file] = await db
    .select()
    .from(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, student.id)))
  if (!file) throw new Error("File not found")

  // A teacher-assigned file is part of the class work and is not the student's
  // to delete.
  if (file.assignedByTeacher) {
    throw new Error("This file was assigned by your teacher and can't be deleted.")
  }

  await db
    .delete(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, student.id)))
  revalidatePath("/student")
  return { ok: true }
}

// ---------- Teacher: read student files in a class ----------
export async function getClassTree(classId: number, languageInput: LanguageId = "python") {
  const teacher = await requireUser()
  const language = toLanguageId(languageInput)
  await requireTeacherCapability(teacher.id)

  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
  if (!cls) throw new Error("Class not found")

  const enrolled = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.classId, classId))

  const studentIds = enrolled.map((e) => e.studentId)
  const students = studentIds.length
    ? await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(inArray(user.id, studentIds))
    : []

  const files = studentIds.length
    ? await db
        .select()
        .from(codeFiles)
        .where(and(eq(codeFiles.classId, classId), eq(codeFiles.language, language)))
        .orderBy(desc(codeFiles.updatedAt))
    : []

  const folders = studentIds.length
    ? await db
        .select()
        .from(studentFolders)
        .where(
          and(
            eq(studentFolders.classId, classId),
            eq(studentFolders.language, language),
          ),
        )
        .orderBy(asc(studentFolders.name))
    : []

  return {
    class: cls,
    students: students
      .map((s) => {
        const studentFiles = files.filter((f) => f.studentId === s.id)
        return {
          ...s,
          folders: folders
            .filter((folder) => folder.studentId === s.id)
            .map((folder) => ({
              ...folder,
              files: studentFiles.filter((f) => f.folderId === folder.id),
            })),
          rootFiles: studentFiles.filter((f) => f.folderId === null),
          files: studentFiles,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

// ---------- Comments & marking ----------

// Load a file and verify the teacher owns the class it belongs to.
async function requireTeacherForFile(teacherId: string, fileId: number) {
  const [file] = await db.select().from(codeFiles).where(eq(codeFiles.id, fileId))
  if (!file) throw new Error("File not found")
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, file.classId), eq(classes.teacherId, teacherId)))
  if (!cls) throw new Error("Unauthorized")
  return file
}

// Comments are visible to the teacher who owns the class and to the student
// who owns the file. Ordered oldest → newest so the thread reads naturally.
export async function getFileComments(fileId: number) {
  const me = await requireUser()

  const [file] = await db.select().from(codeFiles).where(eq(codeFiles.id, fileId))
  if (!file) throw new Error("File not found")

  if (file.studentId !== me.id) {
    // Not the owning student — must be the class teacher.
    const [cls] = await db
      .select()
      .from(classes)
      .where(and(eq(classes.id, file.classId), eq(classes.teacherId, me.id)))
    if (!cls) throw new Error("Unauthorized")
  }

  return db
    .select()
    .from(fileComments)
    .where(eq(fileComments.fileId, fileId))
    .orderBy(asc(fileComments.createdAt))
}

export async function addComment(fileId: number, body: string) {
  const teacher = await requireUser()
  await requireTeacherCapability(teacher.id)
  await requireTeacherForFile(teacher.id, fileId)

  const clean = body.trim()
  if (!clean) throw new Error("Comment cannot be empty")

  const [created] = await db
    .insert(fileComments)
    .values({ fileId, teacherId: teacher.id, teacherName: teacher.name, body: clean })
    .returning()

  revalidatePath("/student")
  revalidatePath("/teacher")
  return created
}

export async function deleteComment(commentId: number) {
  const teacher = await requireUser()
  await requireTeacherCapability(teacher.id)
  await db
    .delete(fileComments)
    .where(and(eq(fileComments.id, commentId), eq(fileComments.teacherId, teacher.id)))
  revalidatePath("/student")
  revalidatePath("/teacher")
  return { ok: true }
}

// Toggle a file between "done" and "unmarked".
export async function setFileStatus(fileId: number, status: "done" | "unmarked") {
  const teacher = await requireUser()
  await requireTeacherCapability(teacher.id)
  await requireTeacherForFile(teacher.id, fileId)

  await db
    .update(codeFiles)
    .set({ status, markedAt: status === "done" ? new Date() : null })
    .where(eq(codeFiles.id, fileId))

  revalidatePath("/student")
  revalidatePath("/teacher")
  return { ok: true }
}
