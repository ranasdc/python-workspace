"use server"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  libraryFiles,
  libraryFolders,
  studentFolders,
} from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { and, asc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

async function requireTeacher() {
  const me = await requireUser()
  if (me.role !== "teacher") throw new Error("Only teachers can use the library")
  return me
}

// ---------- Read ----------
export async function getLibrary() {
  const teacher = await requireTeacher()

  const [folders, files] = await Promise.all([
    db
      .select()
      .from(libraryFolders)
      .where(eq(libraryFolders.teacherId, teacher.id))
      .orderBy(asc(libraryFolders.name)),
    db
      .select()
      .from(libraryFiles)
      .where(eq(libraryFiles.teacherId, teacher.id))
      .orderBy(asc(libraryFiles.name)),
  ])

  return {
    folders: folders.map((f) => ({
      ...f,
      files: files.filter((file) => file.folderId === f.id),
    })),
    // Files not inside any folder live at the library root.
    rootFiles: files.filter((f) => f.folderId === null),
  }
}

// ---------- Folders ----------
export async function createLibraryFolder(name: string) {
  const teacher = await requireTeacher()
  const clean = name.trim()
  if (!clean) throw new Error("Folder name is required")

  const [created] = await db
    .insert(libraryFolders)
    .values({ teacherId: teacher.id, name: clean })
    .returning()

  revalidatePath("/teacher")
  return created
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
const STARTER = `# New task
# Describe the exercise here, then distribute it to your students.

print("Let's get started!")
`

export async function createLibraryFile(name: string, folderId: number | null) {
  const teacher = await requireTeacher()
  const clean = name.trim().endsWith(".py") ? name.trim() : `${name.trim()}.py`
  if (!clean || clean === ".py") throw new Error("Enter a file name")

  // Make sure a provided folder belongs to this teacher.
  if (folderId !== null) {
    const [folder] = await db
      .select()
      .from(libraryFolders)
      .where(and(eq(libraryFolders.id, folderId), eq(libraryFolders.teacherId, teacher.id)))
    if (!folder) throw new Error("Folder not found")
  }

  const [created] = await db
    .insert(libraryFiles)
    .values({ teacherId: teacher.id, folderId, name: clean, content: STARTER })
    .returning()

  revalidatePath("/teacher")
  return created
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

  const enrolled = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.classId, classId))
  const enrolledIds = enrolled.map((e) => e.studentId)

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
    content: string
    assignedByTeacher: boolean
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
        content: file.content,
        assignedByTeacher: true,
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
    .where(and(eq(studentFolders.classId, classId), eq(studentFolders.name, folder.name)))

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
