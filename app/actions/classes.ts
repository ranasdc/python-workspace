"use server"

import { db } from "@/lib/db"
import { classes, enrollments, user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { and, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ---------- Teacher ----------
export async function createClass(formData: FormData) {
  const teacher = await requireUser()
  if (teacher.role !== "teacher") throw new Error("Only teachers can create classes")

  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  if (!name) throw new Error("Class name is required")

  // Ensure a unique join code
  let joinCode = makeJoinCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.joinCode, joinCode))
    if (existing.length === 0) break
    joinCode = makeJoinCode()
  }

  const [created] = await db
    .insert(classes)
    .values({ name, description: description || null, joinCode, teacherId: teacher.id })
    .returning()

  revalidatePath("/teacher")
  return created
}

export async function getTeacherClasses() {
  const teacher = await requireUser()
  if (teacher.role !== "teacher") return []

  const teacherClasses = await db
    .select()
    .from(classes)
    .where(eq(classes.teacherId, teacher.id))
    .orderBy(desc(classes.createdAt))

  const classIds = teacherClasses.map((c) => c.id)
  const allEnrollments = classIds.length
    ? await db.select().from(enrollments).where(inArray(enrollments.classId, classIds))
    : []

  const studentIds = [...new Set(allEnrollments.map((e) => e.studentId))]
  const students = studentIds.length
    ? await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(inArray(user.id, studentIds))
    : []

  const studentMap = new Map(students.map((s) => [s.id, s]))

  return teacherClasses.map((c) => ({
    ...c,
    students: allEnrollments
      .filter((e) => e.classId === c.id)
      .map((e) => studentMap.get(e.studentId))
      .filter(Boolean) as { id: string; name: string; email: string }[],
  }))
}

// ---------- Student ----------
export async function joinClass(formData: FormData) {
  const student = await requireUser()
  const rawCode = String(formData.get("joinCode") || "")
    .trim()
    .toUpperCase()
  if (!rawCode) throw new Error("Enter a join code")

  const [target] = await db.select().from(classes).where(eq(classes.joinCode, rawCode))
  if (!target) throw new Error("No class found with that code")

  const existing = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.classId, target.id), eq(enrollments.studentId, student.id)))
  if (existing.length === 0) {
    await db.insert(enrollments).values({ classId: target.id, studentId: student.id })
  }

  revalidatePath("/student")
  return target
}

// Ensure an individual (class-less) student has a personal workspace so the
// class-keyed file system works. Idempotent: returns early if already enrolled.
export async function ensurePersonalWorkspace() {
  const student = await requireUser()

  const existing = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(eq(enrollments.studentId, student.id))
    .limit(1)
  if (existing.length > 0) return

  // Unique join code for the personal class (owned by the student themselves).
  let joinCode = makeJoinCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const dup = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.joinCode, joinCode))
    if (dup.length === 0) break
    joinCode = makeJoinCode()
  }

  const [created] = await db
    .insert(classes)
    .values({
      name: "My Workspace",
      description: "Your personal Python workspace",
      joinCode,
      teacherId: student.id,
    })
    .returning()

  await db
    .insert(enrollments)
    .values({ classId: created.id, studentId: student.id })
    .onConflictDoNothing()
}

export async function getStudentClasses() {
  const student = await requireUser()

  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      description: classes.description,
      joinCode: classes.joinCode,
      teacherId: classes.teacherId,
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .where(eq(enrollments.studentId, student.id))
    .orderBy(desc(enrollments.createdAt))

  return rows
}
