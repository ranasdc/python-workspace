import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildSchoolRoster,
  classesAttendedBy,
  classesTaughtBy,
  matchesPerson,
  toPerson,
} from "../lib/school-roster.ts"

function member(userId, role, extra = {}) {
  return {
    userId,
    role,
    firstName: null,
    lastName: null,
    name: userId,
    email: `${userId}@school.test`,
    joinedAt: null,
    invitedByCodeId: role === "school_admin" ? null : 1,
    ...extra,
  }
}

function enrolment(classId, studentId, extra = {}) {
  return {
    classId,
    studentId,
    firstName: null,
    lastName: null,
    name: studentId,
    email: `${studentId}@school.test`,
    ...extra,
  }
}

const cls = (id, name, teacherId, teacherName = teacherId) => ({ id, name, teacherId, teacherName })

describe("School Teachers", () => {
  it("lists a teacher who joined by invite code but has no class", () => {
    const roster = buildSchoolRoster({
      members: [member("head", "school_admin"), member("newcomer", "teacher")],
      classes: [],
      enrolments: [],
    })
    const newcomer = roster.teachers.find((t) => t.id === "newcomer")
    assert.ok(newcomer)
    assert.equal(newcomer.classCount, 0)
    assert.equal(newcomer.joinedVia, "invite_code")
  })

  it("lists a teacher once however many classes they teach", () => {
    const roster = buildSchoolRoster({
      members: [member("ms-ada", "teacher")],
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada"), cls(3, "Year 10", "ms-ada")],
      enrolments: [],
    })
    assert.equal(roster.teachers.filter((t) => t.id === "ms-ada").length, 1)
    assert.equal(roster.teachers[0].classCount, 3)
    assert.equal(roster.totals.teachers, 1)
  })

  it("names the teacher on each class they teach, and never as a student", () => {
    const roster = buildSchoolRoster({
      members: [member("ms-ada", "teacher"), member("sam", "student")],
      classes: [cls(1, "Year 8", "ms-ada", "Ada Byron"), cls(2, "Year 9", "ms-ada", "Ada Byron")],
      // The teacher is enrolled in her own class, as can happen when testing it.
      enrolments: [enrolment(1, "ms-ada"), enrolment(1, "sam"), enrolment(2, "sam")],
    })
    for (const klass of roster.classes) {
      assert.equal(klass.teacher.name, "Ada Byron")
      assert.ok(!klass.students.some((s) => s.id === "ms-ada"))
    }
  })

  it("keeps a colleague enrolled in a class out of its student list", () => {
    const roster = buildSchoolRoster({
      members: [member("ms-ada", "teacher"), member("mr-bo", "teacher"), member("sam", "student")],
      classes: [cls(1, "Year 8", "ms-ada")],
      enrolments: [enrolment(1, "mr-bo"), enrolment(1, "sam")],
    })
    assert.deepEqual(
      roster.classes[0].students.map((s) => s.id),
      ["sam"],
    )
    assert.equal(roster.totals.uniqueStudents, 1)
  })

  it("lists only the members it is given, so other schools' teachers cannot appear", () => {
    const roster = buildSchoolRoster({
      members: [member("ours", "teacher")],
      // A class of this school whose teacher is not one of its members.
      classes: [cls(1, "Year 8", "outsider", "Out Sider")],
      enrolments: [],
    })
    assert.deepEqual(
      roster.teachers.map((t) => t.id),
      ["ours"],
    )
    assert.equal(roster.classes[0].teacher.isSchoolMember, false)
  })

  it("lists the administrator among the teachers, marked as such", () => {
    const roster = buildSchoolRoster({
      members: [member("head", "school_admin"), member("ms-ada", "teacher")],
      classes: [],
      enrolments: [],
    })
    const head = roster.teachers.find((t) => t.id === "head")
    assert.equal(head.isAdmin, true)
    assert.equal(head.joinedVia, "founder")
    assert.equal(roster.totals.teachers, 2)
  })

  it("does not list student members as teachers", () => {
    const roster = buildSchoolRoster({
      members: [member("sam", "student"), member("ms-ada", "teacher")],
      classes: [],
      enrolments: [],
    })
    assert.deepEqual(
      roster.teachers.map((t) => t.id),
      ["ms-ada"],
    )
  })
})

describe("Classes and Students", () => {
  const members = [
    member("ms-ada", "teacher"),
    member("sam", "student"),
    member("tia", "student"),
    member("uma", "student"),
  ]

  it("lists a student in one class under that class only", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada")],
      enrolments: [enrolment(1, "sam"), enrolment(2, "tia")],
    })
    const [year8, year9] = roster.classes
    assert.deepEqual(year8.students.map((s) => s.id), ["sam"])
    assert.deepEqual(year9.students.map((s) => s.id), ["tia"])
  })

  it("lists a student in several classes under each of them", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada")],
      enrolments: [enrolment(1, "sam"), enrolment(2, "sam")],
    })
    assert.ok(roster.classes.every((klass) => klass.students.some((s) => s.id === "sam")))
  })

  it("counts unique students rather than adding up class sizes", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada"), cls(3, "Year 10", "ms-ada")],
      enrolments: [
        enrolment(1, "sam"),
        enrolment(2, "sam"),
        enrolment(3, "sam"),
        enrolment(1, "tia"),
        enrolment(2, "uma"),
      ],
    })
    const summed = roster.classes.reduce((total, klass) => total + klass.students.length, 0)
    assert.equal(summed, 5)
    assert.equal(roster.totals.uniqueStudents, 3)
  })

  it("no longer lists a student under a class they have left", () => {
    const before = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada")],
      enrolments: [enrolment(1, "sam"), enrolment(2, "sam")],
    })
    assert.ok(before.classes[0].students.some((s) => s.id === "sam"))

    // Leaving a class removes that one enrolment row and nothing else.
    const after = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada")],
      enrolments: [enrolment(2, "sam")],
    })
    assert.ok(!after.classes[0].students.some((s) => s.id === "sam"))
    assert.ok(after.classes[1].students.some((s) => s.id === "sam"))
  })

  it("shows a class with no students rather than dropping it", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada")],
      enrolments: [],
    })
    assert.equal(roster.totals.classes, 1)
    assert.deepEqual(roster.classes[0].students, [])
  })

  it("does not repeat a student enrolled twice in the same class", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada")],
      enrolments: [enrolment(1, "sam"), enrolment(1, "sam")],
    })
    assert.equal(roster.classes[0].students.length, 1)
  })

  it("keeps student members with no class visible, and counts them once", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 8", "ms-ada")],
      enrolments: [enrolment(1, "sam")],
    })
    assert.deepEqual(
      roster.unassignedStudents.map((s) => s.id),
      ["tia", "uma"],
    )
    assert.equal(roster.totals.uniqueStudents, 3)
  })

  it("marks an enrolled student who is not a school member", () => {
    const roster = buildSchoolRoster({
      members: [member("ms-ada", "teacher")],
      classes: [cls(1, "Year 8", "ms-ada")],
      enrolments: [enrolment(1, "guest")],
    })
    assert.equal(roster.classes[0].students[0].isSchoolMember, false)
  })

  it("orders classes naturally, so Year 9 comes before Year 10", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [cls(1, "Year 10", "ms-ada"), cls(2, "Year 9", "ms-ada"), cls(3, "Year 8", "ms-ada")],
      enrolments: [],
    })
    assert.deepEqual(
      roster.classes.map((klass) => klass.name),
      ["Year 8", "Year 9", "Year 10"],
    )
  })

  it("reports a class whose teacher's account is gone as having no teacher", () => {
    const roster = buildSchoolRoster({
      members,
      classes: [{ id: 1, name: "Year 8", teacherId: "deleted", teacherName: null }],
      enrolments: [],
    })
    assert.equal(roster.classes[0].teacher, null)
  })
})

describe("names and search", () => {
  it("uses first and last name when both are stored", () => {
    const person = toPerson({
      id: "1",
      firstName: "Ada",
      lastName: "Byron",
      name: "ada b",
      email: "ada@school.test",
    })
    assert.equal(person.firstName, "Ada")
    assert.equal(person.lastName, "Byron")
    assert.equal(person.displayName, "Ada Byron")
  })

  it("splits the display name for accounts created before names were separate", () => {
    const person = toPerson({
      id: "1",
      firstName: null,
      lastName: null,
      name: "Mary Ann Evans",
      email: "mary@school.test",
    })
    assert.equal(person.firstName, "Mary Ann")
    assert.equal(person.lastName, "Evans")
    assert.equal(person.displayName, "Mary Ann Evans")
  })

  it("matches on name or email, ignoring case and surrounding space", () => {
    const person = toPerson({
      id: "1",
      firstName: "Ada",
      lastName: "Byron",
      name: "Ada Byron",
      email: "a.byron@school.test",
    })
    assert.ok(matchesPerson(person, "  BYRON "))
    assert.ok(matchesPerson(person, "a.byron@"))
    assert.ok(matchesPerson(person, ""))
    assert.ok(!matchesPerson(person, "lovelace"))
  })
})

describe("Removal confirmation", () => {
  const roster = buildSchoolRoster({
    members: [
      member("head", "school_admin"),
      member("ms-ada", "teacher"),
      member("mr-bell", "teacher"),
      member("sam", "student"),
      member("kim", "student"),
    ],
    classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada"), cls(3, "Year 10", "mr-bell")],
    enrolments: [enrolment(1, "sam"), enrolment(1, "kim"), enrolment(3, "sam")],
  })

  it("names every class a teacher teaches, with how many students each holds", () => {
    assert.deepEqual(classesTaughtBy(roster, "ms-ada"), [
      { id: 1, name: "Year 8", studentCount: 2 },
      { id: 2, name: "Year 9", studentCount: 0 },
    ])
  })

  it("names no classes for a teacher who has none, or for someone else's", () => {
    assert.deepEqual(classesTaughtBy(roster, "head"), [])
    assert.deepEqual(classesTaughtBy(roster, "sam"), [])
  })

  it("names the classes a student is enrolled in, and only those", () => {
    assert.deepEqual(
      classesAttendedBy(roster, "sam").map((c) => c.name),
      ["Year 8", "Year 10"],
    )
    assert.deepEqual(
      classesAttendedBy(roster, "kim").map((c) => c.name),
      ["Year 8"],
    )
    assert.deepEqual(classesAttendedBy(roster, "ms-ada"), [])
  })

  it("drops a removed member from the lists and the counts, and nothing else", () => {
    // What the dashboard is given after a removal: the same school, read again
    // without the removed teacher's and student's membership rows.
    const after = buildSchoolRoster({
      members: [member("head", "school_admin"), member("mr-bell", "teacher"), member("kim", "student")],
      classes: [cls(1, "Year 8", "ms-ada"), cls(2, "Year 9", "ms-ada"), cls(3, "Year 10", "mr-bell")],
      enrolments: [enrolment(1, "sam"), enrolment(1, "kim"), enrolment(3, "sam")],
    })

    assert.equal(roster.totals.teachers, 3)
    assert.equal(after.totals.teachers, 2)
    assert.ok(!after.teachers.some((t) => t.id === "ms-ada"))

    // Her classes are still there, still hers, and still hold their students.
    assert.equal(after.totals.classes, 3)
    const year8 = after.classes.find((c) => c.id === 1)
    assert.deepEqual(year8.teacher, { id: "ms-ada", name: "ms-ada", isSchoolMember: false })
    assert.equal(year8.students.length, 2)

    // The removed student keeps their enrolments but no longer holds a seat.
    const sam = year8.students.find((s) => s.id === "sam")
    assert.equal(sam.isSchoolMember, false)
    assert.equal(year8.students.find((s) => s.id === "kim").isSchoolMember, true)
  })
})
