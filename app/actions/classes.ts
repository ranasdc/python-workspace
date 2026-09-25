"use server"

import { randomBytes } from "node:crypto"

import { headers } from "next/headers"

import { db, pool } from "@/lib/db"
import { classes, enrollments, user } from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import {
  assertCanCreateClass,
  getEntitlement,
  getTeacherUsage,
  isSubscriptionLive,
  requireTeacherCapability,
  EntitlementError,
  type EntitlementCode,
} from "@/lib/entitlements"
import { clearFailures, countRecentFailures, recordFailures } from "@/lib/rate-limit"
import { and, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// Unambiguous alphabet: no O/0, I/1 or L, so a code can be read aloud across a
// classroom without the pupils mishearing it.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// 31^8 ~= 8.5e11 codes. At the throttle enforced below, exhausting even a
// millionth of that space would take centuries.
const CODE_LENGTH = 8

/**
 * Join codes are a bearer credential — holding one grants access to a class —
 * so they must not come from Math.random(), whose output is predictable from
 * observed values. rejectionThreshold discards the tail of the byte range that
 * would otherwise bias the result toward the first few letters.
 */
function makeJoinCode(length = CODE_LENGTH) {
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

/**
 * Codes are shown grouped ("K7XM-42QP") but stored unformatted, so the
 * separator is cosmetic and typing it — or omitting it, or using spaces or
 * lowercase — must all resolve to the same class.
 */
function normaliseJoinCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "")
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

export type CreateClassResult =
  | { ok: true; class: typeof classes.$inferSelect }
  | { ok: false; code: EntitlementCode; message: string }

export async function createClass(formData: FormData): Promise<CreateClassResult> {
  const teacher = await requireUser()

  // Entitlement failures (e.g. the free-tier one-class cap) are an expected
  // outcome, not a crash, so they are RETURNED rather than thrown: a thrown
  // Server Action error has its message redacted in production and reaches the
  // client as a generic "Server Components render" digest, which is useless for
  // prompting an upgrade. Returned values cross the boundary intact.
  try {
    await assertCanCreateClass(teacher.id)
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, code: error.code, message: error.message }
    }
    throw error
  }

  const name = String(formData.get("name") || "").trim()
  const description = String(formData.get("description") || "").trim()
  if (!name) {
    return { ok: false, code: "forbidden", message: "Class name is required." }
  }

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
  return { ok: true, class: created }
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

// Deliberately identical for "no such code", "disabled", "expired" and
// "personal workspace". Distinguishing them would turn the join box into an
// oracle that confirms which codes — and therefore which schools — exist.
const INVALID_CODE = "That invite code is invalid or no longer active."
const CROSS_SCHOOL = "You already belong to another school and cannot join this class."
const THROTTLED = "Too many attempts. Please try again later."

const FAILURE_WINDOW_SECONDS = 15 * 60
const MAX_FAILURES_PER_USER = 10
// Looser, because a whole school can share one NAT address; this exists to
// blunt an attacker cycling through accounts, not to limit a classroom.
const MAX_FAILURES_PER_IP = 50

async function callerIp() {
  const h = await headers()
  const forwarded = h.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return h.get("x-real-ip")?.trim() || null
}

/**
 * Join a class by invite code.
 *
 * Everything that decides the outcome — the class, its owner, its school, that
 * school's plan and seat count — is resolved on the server from the code alone.
 * The only value read from the request is the code itself, so there is no
 * class_id, school_id or teacher_id for a caller to forge.
 *
 * Seat limits are enforced inside a transaction that holds a row lock on the
 * class (and on the school's plan when one applies), so two pupils claiming the
 * last seat at the same instant cannot both succeed.
 */
export async function joinClass(formData: FormData) {
  const student = await requireUser()

  const ip = await callerIp()
  const userBucket = `join-class:user:${student.id}`
  const ipBucket = ip ? `join-class:ip:${ip}` : null

  const [userFailures, ipFailures] = await Promise.all([
    countRecentFailures(userBucket, FAILURE_WINDOW_SECONDS),
    ipBucket ? countRecentFailures(ipBucket, FAILURE_WINDOW_SECONDS) : Promise.resolve(0),
  ])
  if (userFailures >= MAX_FAILURES_PER_USER || ipFailures >= MAX_FAILURES_PER_IP) {
    throw new Error(THROTTLED)
  }

  // Only code-guessing failures are recorded. A cross-school or full-class
  // rejection means the code was real, so it is not brute-force evidence and
  // must not throttle a pupil who was handed the wrong code in good faith.
  const guessFailed = async () => {
    await recordFailures([userBucket, ...(ipBucket ? [ipBucket] : [])])
    return new Error(INVALID_CODE)
  }

  const code = normaliseJoinCode(String(formData.get("joinCode") || ""))
  if (!code) throw new Error("Enter a join code")

  const [preview] = await db.select().from(classes).where(eq(classes.joinCode, code))
  if (!preview) throw await guessFailed()
  // Personal workspaces carry a code only because the file system is keyed on a
  // class. They are private, and must look exactly like a bad code.
  if (preview.isPersonal) throw await guessFailed()
  if (!preview.joinCodeActive) throw await guessFailed()
  if (preview.joinCodeExpiresAt && preview.joinCodeExpiresAt.getTime() <= Date.now()) {
    throw await guessFailed()
  }
  if (preview.teacherId === student.id) throw new Error("You already own this class")

  // Teaching accounts do not enrol as pupils; a teacher who needs a class of
  // their own creates one. Derived from entitlements, never from the session.
  const mine = await getEntitlement(student.id)
  if (mine.isTeacher) {
    throw new Error("Only student accounts can join a class with an invite code.")
  }

  // Resolved before the transaction opens: this can call Stripe, and a network
  // round trip must never happen while we are holding row locks.
  const owner = await getEntitlement(preview.teacherId)
  const maxPerClass = owner.teacherLimits.maxStudentsPerClass

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // Re-read under lock: everything checked above could have changed, and this
    // serialises concurrent joins to the same class.
    const { rows: classRows } = await client.query(
      `SELECT * FROM "class" WHERE "joinCode" = $1 FOR UPDATE`,
      [code],
    )
    const target = classRows[0]
    if (
      !target ||
      target.isPersonal ||
      !target.joinCodeActive ||
      (target.joinCodeExpiresAt && new Date(target.joinCodeExpiresAt) <= new Date())
    ) {
      throw new Error(INVALID_CODE)
    }

    const { rows: memberRows } = await client.query(
      `SELECT * FROM "school_member" WHERE "userId" = $1 AND "status" = 'active'`,
      [student.id],
    )
    const membership = memberRows[0] ?? null

    if (target.schoolId !== null) {
      // Belonging elsewhere is disqualifying regardless of how valid the code
      // is: a School A pupil must never land in a School B class.
      if (membership && membership.schoolId !== target.schoolId) {
        throw new Error(CROSS_SCHOOL)
      }

      const { rows: planRows } = await client.query(
        `SELECT * FROM "school_subscription" WHERE "schoolId" = $1 FOR UPDATE`,
        [target.schoolId],
      )
      const plan = planRows[0]
      // A valid code is not entitlement. The school itself must be paying, and
      // status alone can be stale, so the period is checked too.
      if (!plan || !isSubscriptionLive(plan.status, plan.currentPeriodEnd)) {
        throw new Error("This school does not have an active plan.")
      }

      // An unattached pupil joining a school class becomes a member of that
      // school — which means they take a seat, and the cap applies.
      if (!membership) {
        const limit = plan.studentSeatLimit
        if (limit !== null && limit !== undefined) {
          const { rows: usedRows } = await client.query(
            `SELECT COUNT(*)::int AS used FROM "school_member"
              WHERE "schoolId" = $1 AND "status" = 'active' AND "role" = 'student'`,
            [target.schoolId],
          )
          if (usedRows[0].used >= limit) {
            throw new Error("Your school has reached its student seat limit.")
          }
        }

        // Re-activates a previously removed row rather than inserting a second
        // one, so rejoining never duplicates the pupil's membership.
        await client.query(
          `INSERT INTO "school_member" ("schoolId", "userId", "role")
           VALUES ($1, $2, 'student')
           ON CONFLICT ("schoolId", "userId")
           DO UPDATE SET "status" = 'active', "role" = 'student'`,
          [target.schoolId, student.id],
        )
      }
    }

    const { rows: already } = await client.query(
      `SELECT 1 FROM "enrollment" WHERE "classId" = $1 AND "studentId" = $2`,
      [target.id, student.id],
    )

    if (already.length === 0) {
      // Seat cap is charged against the class owner's plan, not the joiner's.
      if (maxPerClass !== null) {
        const { rows: seatRows } = await client.query(
          `SELECT COUNT(*)::int AS used FROM "enrollment"
            WHERE "classId" = $1 AND "studentId" <> $2`,
          [target.id, target.teacherId],
        )
        if (seatRows[0].used >= maxPerClass) {
          throw new EntitlementError(
            "student_limit",
            "This class is full. Ask your teacher to upgrade to Teacher Pro for unlimited students.",
          )
        }
      }

      await client.query(
        `INSERT INTO "enrollment" ("classId", "studentId") VALUES ($1, $2)
         ON CONFLICT ("classId", "studentId") DO NOTHING`,
        [target.id, student.id],
      )
    }

    await client.query("COMMIT")

    await clearFailures(userBucket)

    revalidatePath("/student")
    revalidatePath("/school")
    return target as typeof classes.$inferSelect
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
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
      description: "Your personal coding workspace",
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
