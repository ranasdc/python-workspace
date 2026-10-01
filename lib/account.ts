import { cache } from "react"
import { and, count, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  account as authAccount,
  classes,
  enrollments,
  schoolMembers,
  schools,
  user,
} from "@/lib/db/schema"
import {
  getEntitlement,
  isSchoolAdminRole,
  type Entitlement,
  type SchoolRole,
} from "@/lib/entitlements"

/**
 * The account layer. It answers "who is this person, what are they a member of,
 * and where does their access come from" in one place, so the profile pages,
 * the header and the class rosters all describe a user the same way.
 *
 * It decides nothing: every capability still comes from lib/entitlements.ts,
 * which remains the only authority on what a user may do.
 */

export type SchoolMembership = {
  schoolId: number
  schoolName: string
  role: SchoolRole
  status: string
  joinedAt: Date
  isAdmin: boolean
}

/**
 * The school a user actually belongs to, read from the membership table.
 *
 * This is the only sanctioned source of a user's school. It is never inferred
 * from a class name, an email domain, an invite code or anything the client
 * sent, so the school shown next to a name is always one the database agrees
 * with.
 */
export const getSchoolMembership = cache(
  async (userId: string): Promise<SchoolMembership | null> => {
    const [row] = await db
      .select({
        schoolId: schoolMembers.schoolId,
        schoolName: schools.name,
        role: schoolMembers.role,
        status: schoolMembers.status,
        joinedAt: schoolMembers.joinedAt,
      })
      .from(schoolMembers)
      .innerJoin(schools, eq(schools.id, schoolMembers.schoolId))
      .where(and(eq(schoolMembers.userId, userId), eq(schoolMembers.status, "active")))
      .limit(1)

    if (!row) return null
    const role = row.role as SchoolRole
    return { ...row, role, isAdmin: isSchoolAdminRole(role) }
  },
)

/**
 * School names for a set of users, for lists that show several people at once.
 * Users with no school are simply absent from the map, which is what lets an
 * independent teacher render without a school line.
 */
export async function getSchoolNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return new Map()

  const rows = await db
    .select({ userId: schoolMembers.userId, schoolName: schools.name })
    .from(schoolMembers)
    .innerJoin(schools, eq(schools.id, schoolMembers.schoolId))
    .where(
      and(inArray(schoolMembers.userId, unique), eq(schoolMembers.status, "active")),
    )

  return new Map(rows.map((r) => [r.userId, r.schoolName]))
}

// ---------- How a user's plan reached them ----------

export type PlanProvenance = {
  /** What to call the tier, e.g. "Teacher Pro". */
  label: string
  /** Where the access comes from, which decides who may manage the billing. */
  kind: "personal" | "school" | "teacher" | "free"
  /** The school or teacher paying, when someone else is. */
  providedBy: string | null
  /** True only when this user's own card is being charged. */
  billable: boolean
}

/**
 * Names the plan and, crucially, its source.
 *
 * A teacher given Pro by their school is not an individual subscriber: they
 * have no card on file, no renewal of their own and nothing to cancel. Keeping
 * "which tier" and "who pays" as separate facts is what stops the UI offering
 * them billing controls that would do nothing.
 */
export function describePlan(
  entitlement: Entitlement,
  schoolName: string | null,
): PlanProvenance {
  const tier =
    entitlement.plan === "school"
      ? entitlement.isTeacher
        ? "Teacher Pro"
        : "Student Pro"
      : entitlement.plan === "teacher_pro"
        ? "Teacher Pro"
        : entitlement.plan === "student_pro"
          ? "Student Pro"
          : entitlement.isTeacher
            ? "Teacher Free"
            : "Student Free"

  if (entitlement.source === "school") {
    return {
      label: tier,
      kind: "school",
      providedBy: schoolName ?? "your school",
      billable: false,
    }
  }
  if (entitlement.source === "teacher") {
    return {
      label: tier,
      kind: "teacher",
      providedBy: entitlement.coveredByTeacherName ?? "your teacher",
      billable: false,
    }
  }
  if (entitlement.source === "individual") {
    return { label: tier, kind: "personal", providedBy: null, billable: true }
  }
  return { label: tier, kind: "free", providedBy: null, billable: true }
}

/** The role label shown beside a person's name. */
export function roleLabel(
  entitlement: Pick<Entitlement, "isTeacher" | "schoolRole">,
): string {
  if (isSchoolAdminRole(entitlement.schoolRole)) return "School admin"
  return entitlement.isTeacher ? "Teacher" : "Student"
}

/**
 * The identity the app header shows: who you are, and the school you belong
 * to. Resolved server-side on every page that renders the header so the school
 * beside a name is always the one the membership table agrees with.
 */
export const getHeaderIdentity = cache(async (userId: string) => {
  const [entitlement, membership, record] = await Promise.all([
    getEntitlement(userId),
    getSchoolMembership(userId),
    db
      .select({ image: user.image })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
  ])

  return {
    image: record[0]?.image ?? null,
    roleLabel: roleLabel(entitlement),
    schoolName: membership?.schoolName ?? null,
    // An administrator of a school whose plan has lapsed keeps the role but
    // not the shortcut, matching how the teacher dashboard already behaves.
    isSchoolAdmin: Boolean(membership?.isAdmin) && !entitlement.schoolUnpaid,
  }
})

// ---------- The profile payload ----------

export type TeacherClassSummary = {
  id: number
  name: string
  studentCount: number
}

export type StudentClassSummary = {
  id: number
  name: string
  teacherName: string
  /** The teacher's school, or null when they teach independently. */
  schoolName: string | null
  joinedAt: Date
}

export type AccountProfile = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    createdAt: Date
  }
  entitlement: Entitlement
  membership: SchoolMembership | null
  plan: PlanProvenance
  roleLabel: string
  /** True when this account signs in with a password it can change. */
  hasPassword: boolean
  /** Populated for teachers only. */
  teacherClasses: TeacherClassSummary[]
  /** Populated for students only. Personal workspaces are excluded. */
  studentClasses: StudentClassSummary[]
  canManageSchool: boolean
}

/**
 * Everything the account area needs about one user, resolved server-side.
 *
 * Teacher and student class lists are mutually exclusive, so a student never
 * receives teacher data to render and vice versa.
 */
export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const [record] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!record) return null

  const [entitlement, membership, credential] = await Promise.all([
    getEntitlement(userId),
    getSchoolMembership(userId),
    db
      .select({ id: authAccount.id })
      .from(authAccount)
      .where(
        and(eq(authAccount.userId, userId), eq(authAccount.providerId, "credential")),
      )
      .limit(1),
  ])

  const teacherClasses = entitlement.isTeacher
    ? await db
        .select({
          id: classes.id,
          name: classes.name,
          studentCount: count(enrollments.id),
        })
        .from(classes)
        .leftJoin(enrollments, eq(enrollments.classId, classes.id))
        .where(and(eq(classes.teacherId, userId), eq(classes.isPersonal, false)))
        .groupBy(classes.id, classes.name)
        .orderBy(classes.name)
    : []

  const studentClasses = entitlement.isTeacher ? [] : await readStudentClasses(userId)

  return {
    user: record,
    entitlement,
    membership,
    plan: describePlan(entitlement, membership?.schoolName ?? null),
    roleLabel: roleLabel(entitlement),
    hasPassword: credential.length > 0,
    teacherClasses,
    studentClasses,
    canManageSchool: Boolean(membership?.isAdmin),
  }
}

/**
 * The classes a pupil is in, each with its teacher and that teacher's school.
 *
 * The school is resolved from the teacher's live membership rather than the
 * class row, so a class created before its teacher joined a school still shows
 * the right school today, and a teacher who has none shows none.
 */
async function readStudentClasses(userId: string): Promise<StudentClassSummary[]> {
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      teacherId: classes.teacherId,
      teacherName: user.name,
      joinedAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(user, eq(user.id, classes.teacherId))
    .where(and(eq(enrollments.studentId, userId), eq(classes.isPersonal, false)))
    .orderBy(classes.name)

  const schoolNames = await getSchoolNames(rows.map((r) => r.teacherId))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    teacherName: r.teacherName,
    schoolName: schoolNames.get(r.teacherId) ?? null,
    joinedAt: r.joinedAt,
  }))
}
