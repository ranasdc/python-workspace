import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { classes, enrollments } from "@/lib/db/schema"

export class AccessError extends Error {
  constructor(message = "You don't have access to this class.") {
    super(message)
    this.name = "AccessError"
  }
}

/** The class row, only if the caller is its teacher. */
export async function assertTeacherOwnsClass(userId: string, classId: number) {
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, userId)))
    .limit(1)
  if (!cls) throw new AccessError()
  return cls
}

/** The class row, only if the caller is enrolled in it. */
export async function assertStudentInClass(userId: string, classId: number) {
  const [row] = await db
    .select({ cls: classes })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, userId)))
    .limit(1)
  if (!row) throw new AccessError()
  return row.cls
}

/** Ids of the teacher-led (non-personal) classes a student is enrolled in. */
export async function getStudentTeacherClassIds(userId: string) {
  const rows = await db
    .select({ id: classes.id, name: classes.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, userId), eq(classes.isPersonal, false)))
  return rows
}
