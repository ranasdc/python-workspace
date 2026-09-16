"use server"

import { randomBytes } from "node:crypto"

import { db } from "@/lib/db"
import { classes, enrollments, user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import {
  assertCanCreateClass,
  assertClassHasSeat,
  getEntitlement,
  getTeacherUsage,
  requireTeacherCapability,
  EntitlementError,
} from "@/lib/entitlements"
import { rateLimit } from "@/lib/rate-limit"
import { and, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Unambiguous alphabet: no O/0, I/1, so codes can be read out in a classroom.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/**
 * Join codes are a bearer credential — holding one grants access to a class —
 * so they must not come from Math.random(), whose output is predictable from
 * observed values. rejectionThreshold discards the tail of the byte range that
 * would otherwise bias the result toward the first few letters.
 */
function makeJoinCode(length = 6) {
  const rejectionThreshold = 256 - (256 % CODE_ALPHABET.length)
  let out = ""
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= rejectionThreshold) continue
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length]
      if (out.length === length) break
    }
  }
  return out
}

async function allocateJoinCode() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeJoinCode()
    const existing = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.joinCode, code))
      .limit(1)
    if (existing.length === 0) return code
  }
  throw new Error("Could not allocate a unique join code. Please try again.")
}

// ---------- Teacher ----------
export async function createClass(formData: FormData) {
  const teacher = await requireUser()
  // Also enforces the free-tier class cap.
  await assertCanCreateClass(teacher.id)

  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  if (!name) throw new Error("Class name is required")

  const joinCode = await allocateJoinCode()

  // Classes created by a school teacher belong to that school.
  const entitlement = await getEntitlement(teacher.id)

  const [created] = await db
    .insert(classes)
    .values({
      name,
      description: description || null,
      joinCode,
      teacherId: teacher.id,
      schoolId: entitlement.schoolId,
    })
    .returning()

  revalidatePath("/teacher")
  return created
}

export async function getTeacherClasses() {
  const teacher = await requireUser()
  const entitlement = await getEntitlement(teacher.id)
  if (!entitlement.isTeacher) return []

  const teacherClasses = await db
    .select()
    .from(classes)
    .where(and(eq(classes.teacherId, teacher.id), eq(classes.isPersonal, false)))
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

  // A 6-character code is only ~10^9 possibilities; without a throttle it is
  // brute-forceable. Keyed per account so one attacker cannot spread attempts.
  const limit = rateLimit(`join-class:${student.id}`, 10, 10 * 60 * 1000)
  if (!limit.ok) {
    throw new Error("Too many join attempts. Please wait a few minutes and try again.")
  }

  const rawCode = String(formData.get("joinCode") || "")
    .trim()
    .toUpperCase()
  if (!rawCode) throw new Error("Enter a join code")

  const [target] = await db.select().from(classes).where(eq(classes.joinCode, rawCode))
  if (!target) throw new Error("No class found with that code")

  // Personal workspaces are auto-created with a join code purely because the
  // file system is keyed on a class. They are private: nobody may join one.
  if (target.isPersonal) throw new Error("No class found with that code")
  if (!target.joinCodeActive) throw new Error("That join code is no longer active")
  if (target.teacherId === student.id) throw new Error("You already own this class")

  // Tenant isolation: a class that belongs to a school is only joinable by that
  // school's members, otherwise a leaked code would expose a pupil's work to an
  // unrelated school's staff. Independent teachers' classes stay open.
  if (target.schoolId !== null) {
    const entitlement = await getEntitlement(student.id)
    if (entitlement.schoolId !== target.schoolId) {
      throw new Error("That class belongs to another school")
    }
  }

  const existing = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.classId, target.id), eq(enrollments.studentId, student.id)))

  if (existing.length === 0) {
    // Seat cap is charged against the class owner's plan, not the joiner's.
    await assertClassHasSeat(target.id, target.teacherId)
    await db
      .insert(enrollments)
      .values({ classId: target.id, studentId: student.id })
      .onConflictDoNothing()
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

  const joinCode = await allocateJoinCode()

  const [created] = await db
    .insert(classes)
    .values({
      name: "My Workspace",
      description: "Your personal Python workspace",
      joinCode,
      teacherId: student.id,
      isPersonal: true,
      joinCodeActive: false,
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

/** Surfaces the teacher's free-tier headroom so the UI can prompt an upgrade. */
export async function getTeacherPlanStatus() {
  const teacher = await requireUser()
  try {
    const entitlement = await requireTeacherCapability(teacher.id)
    const usage = await getTeacherUsage(teacher.id)
    return {
      isTeacher: true as const,
      hasTeacherPro: entitlement.hasTeacherPro,
      limits: entitlement.teacherLimits,
      usage,
      schoolUnpaid: entitlement.schoolUnpaid,
    }
  } catch (error) {
    if (error instanceof EntitlementError) return null
    throw error
  }
}
