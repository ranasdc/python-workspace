"use server"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  fileTasks,
  libraryFiles,
  libraryFolders,
  studentFolders,
} from "@/lib/db/schema"
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

  return {
    folders: folders.map((f) => ({
      ...f,
      files: files.filter((file) => file.folderId === f.id).map(decorate),
    })),
    // Files not inside any folder live at the library root.
    rootFiles: files.filter((f) => f.folderId === null).map(decorate),
  }
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
): Promise<CreateLibraryFolderResult> {
  const teacher = await requireTeacher()
  const language = toLanguageId(languageInput)

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

  const [created] = await db
    .insert(libraryFolders)
    .values({ teacherId: teacher.id, name: clean, language })
    .returning()

  revalidatePath("/teacher")
  return { ok: true, folder: created }
}

export async function deleteLibraryFolder(folderId: number) {
  const teacher = await requireTeacher()
  // Remove the folder and every file inside it (scoped to this teacher).
  await db
    .delete(libraryFiles)
    .where(and(eq(libraryFiles.folderId, folderId), eq(libraryFiles.teacherId, teacher.id)))
  await db
    .delete(libraryFolders)
    .where(and(eq(libraryFolders.id, folderId), eq(libraryFolders.teacherId, teacher.id)))
  revalidatePath("/teacher")
  return { ok: true }
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

export async function deleteLibraryFile(fileId: number) {
  const teacher = await requireTeacher()
  await db
    .delete(libraryFiles)
    .where(and(eq(libraryFiles.id, fileId), eq(libraryFiles.teacherId, teacher.id)))
  revalidatePath("/teacher")
  return { ok: true }
}

// ---------- Distribution ----------

// Resolve the set of student ids that should receive a distribution.
// studentId === null means "everyone enrolled in the class".
async function resolveRecipients(teacherId: string, classId: number, studentId: string | null) {
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
  if (!cls) throw new Error("Class not found")

  // Distributed files are flagged assignedByTeacher and are deliberately exempt
  // from the recipient's free-tier quota. Without these two guards a
  // teacher-role account could distribute into its own personal workspace, or
  // to itself, and mint unlimited files the quota never counts.
  if (cls.isPersonal) throw new Error("Cannot distribute into a personal workspace")

  const enrolled = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.classId, classId))
  const enrolledIds = enrolled.map((e) => e.studentId).filter((id) => id !== teacherId)

  if (studentId) {
    if (!enrolledIds.includes(studentId)) throw new Error("Student is not in this class")
    return [studentId]
  }
  return enrolledIds
}

// Copy a set of library files to each recipient. If a recipient already has a
// file with the same name in the same location (folder or root), we skip it so
// their work is never overwritten. `folderIdFor` maps a studentId to the folder
// the files should land in (null = class root).
async function copyFilesToStudents(
  fileIds: number[],
  teacherId: string,
  classId: number,
  recipientIds: string[],
  folderIdFor?: (studentId: string) => number | null,
) {
  if (fileIds.length === 0 || recipientIds.length === 0) return 0

  const sourceFiles = await db
    .select()
    .from(libraryFiles)
    .where(and(inArray(libraryFiles.id, fileIds), eq(libraryFiles.teacherId, teacherId)))
  if (sourceFiles.length === 0) return 0

  const existing = await db
    .select({
      studentId: codeFiles.studentId,
      name: codeFiles.name,
      folderId: codeFiles.folderId,
    })
    .from(codeFiles)
    .where(eq(codeFiles.classId, classId))
  const taken = new Set(existing.map((e) => `${e.studentId}::${e.folderId ?? "root"}::${e.name}`))

  const rows: {
    classId: number
    studentId: string
    folderId: number | null
    name: string
    language: string
    content: string
    assignedByTeacher: boolean
    sourceLibraryFileId: number
  }[] = []

  for (const student of recipientIds) {
    const folderId = folderIdFor ? folderIdFor(student) : null
    for (const file of sourceFiles) {
      if (taken.has(`${student}::${folderId ?? "root"}::${file.name}`)) continue
      rows.push({
        classId,
        studentId: student,
        folderId,
        name: file.name,
        // Carried from the source file, so a distributed page lands in the
        // student's HTML IDE rather than appearing in their Python tree.
        language: file.language,
        content: file.content,
        assignedByTeacher: true,
        // Points back at the library file so the student's copy resolves the
        // teacher's current task text, and picks up later edits to it.
        sourceLibraryFileId: file.id,
      })
    }
  }

  if (rows.length === 0) return 0
  await db.insert(codeFiles).values(rows)
  return rows.length
}

export async function distributeFile(
  fileId: number,
  classId: number,
  studentId: string | null,
) {
  const teacher = await requireTeacher()
  const recipients = await resolveRecipients(teacher.id, classId, studentId)
  const count = await copyFilesToStudents([fileId], teacher.id, classId, recipients)
  revalidatePath("/teacher")
  revalidatePath("/student")
  return { delivered: count, recipients: recipients.length }
}

export async function distributeFolder(
  folderId: number,
  classId: number,
  studentId: string | null,
) {
  const teacher = await requireTeacher()

  // Confirm the folder belongs to this teacher and grab its name.
  const [folder] = await db
    .select()
    .from(libraryFolders)
    .where(and(eq(libraryFolders.id, folderId), eq(libraryFolders.teacherId, teacher.id)))
  if (!folder) throw new Error("Folder not found")

  const files = await db
    .select({ id: libraryFiles.id })
    .from(libraryFiles)
    .where(and(eq(libraryFiles.folderId, folderId), eq(libraryFiles.teacherId, teacher.id)))
  if (files.length === 0) throw new Error("This folder has no files to distribute")

  const recipients = await resolveRecipients(teacher.id, classId, studentId)

  // Recreate the folder itself for each recipient so the whole folder is
  // shared — reusing an existing teacher-assigned folder of the same name to
  // avoid duplicates on repeat distributions.
  const existingFolders = await db
    .select()
    .from(studentFolders)
    .where(
      and(
        eq(studentFolders.classId, classId),
        eq(studentFolders.name, folder.name),
        // Same-named folders in different IDEs are different folders.
        eq(studentFolders.language, folder.language),
      ),
    )

  const folderByStudent = new Map<string, number>()
  for (const ef of existingFolders) {
    if (ef.assignedByTeacher) folderByStudent.set(ef.studentId, ef.id)
  }

  const toCreate = recipients.filter((s) => !folderByStudent.has(s))
  if (toCreate.length > 0) {
    const created = await db
      .insert(studentFolders)
      .values(
        toCreate.map((s) => ({
          classId,
          studentId: s,
          name: folder.name,
          language: folder.language,
          assignedByTeacher: true,
        })),
      )
      .returning()
    for (const c of created) folderByStudent.set(c.studentId, c.id)
  }

  const count = await copyFilesToStudents(
    files.map((f) => f.id),
    teacher.id,
    classId,
    recipients,
    (student) => folderByStudent.get(student) ?? null,
  )
  revalidatePath("/teacher")
  revalidatePath("/student")
  return { delivered: count, recipients: recipients.length, folder: folder.name }
}
