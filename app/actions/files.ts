"use server"

import { db } from "@/lib/db"
import { classes, codeFiles, enrollments, user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
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

// ---------- Student: manage own files ----------
export async function getStudentFiles(classId: number) {
  const student = await requireUser()
  await assertEnrolled(student.id, classId)
  return db
    .select()
    .from(codeFiles)
    .where(and(eq(codeFiles.classId, classId), eq(codeFiles.studentId, student.id)))
    .orderBy(asc(codeFiles.name))
}

export async function createFile(classId: number, name: string) {
  const student = await requireUser()
  await assertEnrolled(student.id, classId)

  const clean = name.trim().endsWith(".py") ? name.trim() : `${name.trim()}.py`
  if (!clean || clean === ".py") throw new Error("Enter a file name")

  const [created] = await db
    .insert(codeFiles)
    .values({ classId, studentId: student.id, name: clean, content: STARTER })
    .returning()

  revalidatePath("/student")
  return created
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

  return {
    class: cls,
    students: students
      .map((s) => ({
        ...s,
        files: files.filter((f) => f.studentId === s.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
