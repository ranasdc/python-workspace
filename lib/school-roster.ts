/**
 * Shapes a school's people for the administrator dashboard.
 *
 * Two relationships are kept apart here because they are different facts:
 *
 * - School membership (`school_member`) says who belongs to the school. A
 *   teacher holds it from the moment they redeem the school's invite code,
 *   whether or not they have a class yet.
 * - Class enrolment (`enrollment`) says which students are in which class.
 *
 * Teachers are therefore listed once, from membership alone, and students are
 * listed under each class they are enrolled in. Pure and database-free so the
 * rules can be tested directly.
 */

export const STAFF_ROLES = ["teacher", "school_admin"] as const

export type RosterMemberRow = {
  userId: string
  role: string
  firstName: string | null
  lastName: string | null
  name: string
  email: string
  joinedAt: Date | string | null
  /** Set when this member joined by redeeming one of the school's codes. */
  invitedByCodeId: number | null
}

export type RosterClassRow = {
  id: number
  name: string
  teacherId: string
  /** Null when the teacher's account no longer exists. */
  teacherName: string | null
}

export type RosterEnrolmentRow = {
  classId: number
  studentId: string
  firstName: string | null
  lastName: string | null
  name: string
  email: string
}

export type RosterPerson = {
  id: string
  firstName: string
  lastName: string
  /** First and last name together, falling back to the stored display name. */
  displayName: string
  email: string
}

export type SchoolTeacher = RosterPerson & {
  isAdmin: boolean
  joinedAt: Date | string | null
  joinedVia: "founder" | "invite_code" | "unrecorded"
  classCount: number
}

export type SchoolStudent = RosterPerson & {
  /** Whether they hold an active membership, and so occupy a student seat. */
  isSchoolMember: boolean
}

export type SchoolClass = {
  id: number
  name: string
  teacher: { id: string; name: string; isSchoolMember: boolean } | null
  students: SchoolStudent[]
}

export type SchoolRoster = {
  teachers: SchoolTeacher[]
  classes: SchoolClass[]
  /** Student members of the school who are not enrolled in any of its classes. */
  unassignedStudents: SchoolStudent[]
  totals: { teachers: number; classes: number; uniqueStudents: number }
}

function isStaffRole(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role)
}

/**
 * Names were collected as one field before sign-up asked for two, so older
 * accounts have only the display name. It is split on the last space as a
 * best effort rather than leaving the columns empty.
 */
export function toPerson(row: {
  id: string
  firstName: string | null
  lastName: string | null
  name: string
  email: string
}): RosterPerson {
  const first = row.firstName?.trim() ?? ""
  const last = row.lastName?.trim() ?? ""
  const stored = row.name.trim()

  if (first || last) {
    return {
      id: row.id,
      firstName: first,
      lastName: last,
      displayName: [first, last].filter(Boolean).join(" "),
      email: row.email,
    }
  }

  const cut = stored.lastIndexOf(" ")
  return {
    id: row.id,
    firstName: cut === -1 ? stored : stored.slice(0, cut),
    lastName: cut === -1 ? "" : stored.slice(cut + 1),
    displayName: stored,
    email: row.email,
  }
}

function byName(a: RosterPerson, b: RosterPerson) {
  return (
    a.displayName.localeCompare(b.displayName, "en", { sensitivity: "base" }) ||
    a.email.localeCompare(b.email)
  )
}

export function buildSchoolRoster(input: {
  /** Active members of this school only. */
  members: RosterMemberRow[]
  /** Classes whose `schoolId` is this school. */
  classes: RosterClassRow[]
  /** Enrolments in those classes. */
  enrolments: RosterEnrolmentRow[]
}): SchoolRoster {
  const staffIds = new Set<string>()
  const memberIds = new Set<string>()
  for (const member of input.members) {
    memberIds.add(member.userId)
    if (isStaffRole(member.role)) staffIds.add(member.userId)
  }

  const classCountByTeacher = new Map<string, number>()
  for (const cls of input.classes) {
    classCountByTeacher.set(cls.teacherId, (classCountByTeacher.get(cls.teacherId) ?? 0) + 1)
  }

  // One entry per person, however many classes they teach: the list is built
  // from membership, and a member row is unique per school and user.
  const seenTeachers = new Set<string>()
  const teachers: SchoolTeacher[] = []
  for (const member of input.members) {
    if (!isStaffRole(member.role) || seenTeachers.has(member.userId)) continue
    seenTeachers.add(member.userId)
    const isAdmin = member.role === "school_admin"
    teachers.push({
      ...toPerson({ ...member, id: member.userId }),
      isAdmin,
      joinedAt: member.joinedAt,
      joinedVia:
        member.invitedByCodeId !== null ? "invite_code" : isAdmin ? "founder" : "unrecorded",
      classCount: classCountByTeacher.get(member.userId) ?? 0,
    })
  }
  teachers.sort(byName)

  const enrolmentsByClass = new Map<number, RosterEnrolmentRow[]>()
  for (const row of input.enrolments) {
    const list = enrolmentsByClass.get(row.classId)
    if (list) list.push(row)
    else enrolmentsByClass.set(row.classId, [row])
  }

  const enrolledStudentIds = new Set<string>()
  const classes: SchoolClass[] = input.classes.map((cls) => {
    const seen = new Set<string>()
    const students: SchoolStudent[] = []
    for (const row of enrolmentsByClass.get(cls.id) ?? []) {
      // A member of staff sitting in a class — the teacher who owns it, or a
      // colleague trying it out — is not one of its students.
      if (row.studentId === cls.teacherId || staffIds.has(row.studentId)) continue
      if (seen.has(row.studentId)) continue
      seen.add(row.studentId)
      enrolledStudentIds.add(row.studentId)
      students.push({
        ...toPerson({ ...row, id: row.studentId }),
        isSchoolMember: memberIds.has(row.studentId),
      })
    }
    students.sort(byName)

    return {
      id: cls.id,
      name: cls.name,
      teacher:
        cls.teacherName === null
          ? null
          : { id: cls.teacherId, name: cls.teacherName, isSchoolMember: staffIds.has(cls.teacherId) },
      students,
    }
  })
  classes.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }))

  const unassignedStudents: SchoolStudent[] = input.members
    .filter((member) => !isStaffRole(member.role) && !enrolledStudentIds.has(member.userId))
    .map((member) => ({ ...toPerson({ ...member, id: member.userId }), isSchoolMember: true }))
    .sort(byName)

  // A set of ids, so a student in three classes is one student.
  const uniqueStudents = new Set([
    ...enrolledStudentIds,
    ...unassignedStudents.map((student) => student.id),
  ])

  return {
    teachers,
    classes,
    unassignedStudents,
    totals: {
      teachers: teachers.length,
      classes: classes.length,
      uniqueStudents: uniqueStudents.size,
    },
  }
}

/** Case-insensitive match on any part of a person's name or email. */
export function matchesPerson(person: RosterPerson, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    person.displayName.toLowerCase().includes(needle) ||
    person.email.toLowerCase().includes(needle)
  )
}
