"use server"

import { db } from "@/lib/db"
import {
  classes,
  codeFiles,
  enrollments,
  fileComments,
  studentFolders,
  user,
} from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const STARTER = `# Welcome to your Python file!
# Write code below and press Run to execute it in your browser.

print("Hello, world!")
`

async function assertEnrolled(studentId: string, classId: number) {
  const [row] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.classId, classId)))
  if (!row) throw new Error("You are not enrolled in this class")
}

// ---------- Student: manage own files & folders ----------
export async function getStudentFiles(classId: number) {
  const student = await requireUser()
  await assertEnrolled(student.id, classId)

  const [folders, files] = await Promise.all([
    db
      .select()
      .from(studentFolders)
      .where(and(eq(studentFolders.classId, classId), eq(studentFolders.studentId, student.id)))
      .orderBy(asc(studentFolders.name)),
    db
      .select()
      .from(codeFiles)
      .where(and(eq(codeFiles.classId, classId), eq(codeFiles.studentId, student.id)))
      .orderBy(asc(codeFiles.name)),
  ])

  return {
    folders: folders.map((folder) => ({
      ...folder,
      files: files.filter((f) => f.folderId === folder.id),
    })),
    // Files not inside any folder live at the class root.
    rootFiles: files.filter((f) => f.folderId === null),
  }
}

export async function createFile(classId: number, name: string, folderId: number | null = null) {
  const student = await requireUser()
  await assertEnrolled(student.id, classId)

  const clean = name.trim().endsWith(".py") ? name.trim() : `${name.trim()}.py`
  if (!clean || clean === ".py") throw new Error("Enter a file name")

  // Make sure a provided folder belongs to this student in this class.
  if (folderId !== null) {
    const [folder] = await db
      .select()
      .from(studentFolders)
      .where(
        and(
          eq(studentFolders.id, folderId),
          eq(studentFolders.studentId, student.id),
          eq(studentFolders.classId, classId),
        ),
      )
    if (!folder) throw new Error("Folder not found")
  }

  const [created] = await db
    .insert(codeFiles)
    .values({ classId, studentId: student.id, folderId, name: clean, content: STARTER })
    .returning()

  revalidatePath("/student")
  return created
}

export async function createStudentFolder(classId: number, name: string) {
  const student = await requireUser()
  await assertEnrolled(student.id, classId)

  const clean = name.trim()
  if (!clean) throw new Error("Enter a folder name")

  const [created] = await db
    .insert(studentFolders)
    .values({ classId, studentId: student.id, name: clean })
    .returning()

  revalidatePath("/student")
  return created
}

// Delete a folder and every file inside it (scoped to this student).
export async function deleteStudentFolder(folderId: number) {
  const student = await requireUser()
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
  await db
    .delete(codeFiles)
    .where(and(eq(codeFiles.id, fileId), eq(codeFiles.studentId, student.id)))
  revalidatePath("/student")
  return { ok: true }
}

// ---------- Teacher: read student files in a class ----------
export async function getClassTree(classId: number) {
  const teacher = await requireUser()
  if (teacher.role !== "teacher") throw new Error("Unauthorized")

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
        .where(eq(codeFiles.classId, classId))
        .orderBy(desc(codeFiles.updatedAt))
    : []

  const folders = studentIds.length
    ? await db
        .select()
        .from(studentFolders)
        .where(eq(studentFolders.classId, classId))
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
  if (teacher.role !== "teacher") throw new Error("Only teachers can comment")
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
  if (teacher.role !== "teacher") throw new Error("Unauthorized")
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
  if (teacher.role !== "teacher") throw new Error("Only teachers can mark work")
  await requireTeacherForFile(teacher.id, fileId)

  await db
    .update(codeFiles)
    .set({ status, markedAt: status === "done" ? new Date() : null })
    .where(eq(codeFiles.id, fileId))

  revalidatePath("/student")
  revalidatePath("/teacher")
  return { ok: true }
}
