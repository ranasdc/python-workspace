"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"

import { MAX_INVITE_DAYS, MAX_INVITE_USES } from "@/lib/invite-codes"
import { and, count, eq, inArray, sql } from "drizzle-orm"

import { db, pool } from "@/lib/db"
import {
  classes,
  enrollments,
  inviteCodes,
  schoolMembers,
  schoolSubscriptions,
  schools,
  user,
} from "@/lib/db/schema"
import { buildSchoolRoster } from "@/lib/school-roster"
import { requireUser } from "@/lib/session"
import {
  getEntitlement,
  isSchoolAdminRole,
  isSubscriptionLive,
  requireSchoolAdmin,
} from "@/lib/entitlements"
import { refreshSubscriptionFromStripe } from "@/lib/billing-refresh"

// Unambiguous alphabet: no O/0, I/1.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function makeInviteCode(length = 12) {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return out
}

/**
 * Creating a school makes the creator its administrator. This is the only way
 * to become a school_admin — the role can never be chosen at sign-up.
 */
export async function createSchool(formData: FormData) {
  const me = await requireUser()
  const name = String(formData.get("name") || "").trim()
  if (!name) throw new Error("School name is required")

  const existing = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.userId, me.id), eq(schoolMembers.status, "active")))
    .limit(1)
  if (existing.length > 0) throw new Error("You already belong to a school")

  const [school] = await db.insert(schools).values({ name, createdBy: me.id }).returning()

  await db.insert(schoolMembers).values({
    schoolId: school.id,
    userId: me.id,
    role: "school_admin",
  })

  revalidatePath("/school")
  return school
}

/**
 * Validates the limits an administrator asked for.
 *
 * Run on the server for every create and replace, because these two numbers
 * are what the redemption path later enforces: a forged request asking for a
 * million uses or a ten-year expiry must be rejected here, not trusted.
 */
function normaliseInviteLimits(options?: {
  maxUses?: number | null
  expiresInDays?: number | null
}) {
  const rawUses = options?.maxUses
  let maxUses: number | null = null
  if (rawUses !== null && rawUses !== undefined) {
    if (!Number.isInteger(rawUses) || rawUses < 1 || rawUses > MAX_INVITE_USES) {
      throw new Error(`Maximum uses must be a whole number between 1 and ${MAX_INVITE_USES}`)
    }
    maxUses = rawUses
  }

  const rawDays = options?.expiresInDays
  let expiresAt: Date | null = null
  if (rawDays !== null && rawDays !== undefined) {
    if (!Number.isInteger(rawDays) || rawDays < 1 || rawDays > MAX_INVITE_DAYS) {
      throw new Error(`Expiry must be a whole number of days between 1 and ${MAX_INVITE_DAYS}`)
    }
    expiresAt = new Date(Date.now() + rawDays * 86_400_000)
  }

  return { maxUses, expiresAt }
}

export async function createInviteCode(
  schoolId: number,
  role: "student" | "teacher",
  options?: { maxUses?: number | null; expiresInDays?: number | null },
) {
  const admin = await requireSchoolAdmin(schoolId)
  if (role !== "teacher") {
    throw new Error("Students join through their teacher's class code, not a school code")
  }

  const { maxUses, expiresAt } = normaliseInviteLimits(options)

  let code = makeInviteCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const dup = await db
      .select({ id: inviteCodes.id })
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code))
      .limit(1)
    if (dup.length === 0) break
    code = makeInviteCode()
  }

  const [created] = await db
    .insert(inviteCodes)
    .values({
      schoolId: admin.schoolId,
      code,
      role,
      maxUses,
      expiresAt,
      createdBy: admin.user.id,
    })
    .returning()

  revalidatePath("/school")
  return created
}

/**
 * Replace a code with a fresh one carrying the same limits.
 *
 * The old code is disabled rather than deleted: the teachers who joined
 * through it keep their attribution, and the administrator can still see who
 * used the code they have just retired.
 */
export async function regenerateInviteCode(codeId: number) {
  const [existing] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.id, codeId))
    .limit(1)
  if (!existing) throw new Error("Invite code not found")

  const admin = await requireSchoolAdmin(existing.schoolId)

  // Carry the remaining expiry window across rather than the original date,
  // which may well be in the past by now.
  const daysLeft = existing.expiresAt
    ? Math.max(
        1,
        Math.ceil((new Date(existing.expiresAt).getTime() - Date.now()) / 86_400_000),
      )
    : null

  await db.update(inviteCodes).set({ active: false }).where(eq(inviteCodes.id, codeId))

  let code = makeInviteCode()
  for (let attempt = 0; attempt < 5; attempt++) {
    const dup = await db
      .select({ id: inviteCodes.id })
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code))
      .limit(1)
    if (dup.length === 0) break
    code = makeInviteCode()
  }

  const [created] = await db
    .insert(inviteCodes)
    .values({
      schoolId: admin.schoolId,
      code,
      role: existing.role,
      maxUses: existing.maxUses,
      expiresAt: daysLeft ? new Date(Date.now() + daysLeft * 86_400_000) : null,
      createdBy: admin.user.id,
    })
    .returning()

  revalidatePath("/school")
  return created
}

/**
 * Who joined on a given code. Scoped to the code's own school and gated on
 * administrator rights, so one school can never enumerate another's staff.
 */
export async function getInviteCodeUsage(codeId: number) {
  const [row] = await db
    .select({ schoolId: inviteCodes.schoolId })
    .from(inviteCodes)
    .where(eq(inviteCodes.id, codeId))
    .limit(1)
  if (!row) throw new Error("Invite code not found")

  await requireSchoolAdmin(row.schoolId)

  return db
    .select({
      userId: schoolMembers.userId,
      name: user.name,
      email: user.email,
      avatarId: user.avatarId,
      role: schoolMembers.role,
      status: schoolMembers.status,
      joinedAt: schoolMembers.joinedAt,
    })
    .from(schoolMembers)
    .innerJoin(user, eq(user.id, schoolMembers.userId))
    .where(
      and(
        eq(schoolMembers.invitedByCodeId, codeId),
        eq(schoolMembers.schoolId, row.schoolId),
      ),
    )
    .orderBy(sql`${schoolMembers.joinedAt} desc`)
}

export async function setInviteCodeActive(codeId: number, active: boolean) {
  const me = await requireUser()

  const [row] = await db
    .select({ schoolId: inviteCodes.schoolId })
    .from(inviteCodes)
    .where(eq(inviteCodes.id, codeId))
    .limit(1)
  if (!row) throw new Error("Invite code not found")

  await requireSchoolAdmin(row.schoolId)

  await db.update(inviteCodes).set({ active }).where(eq(inviteCodes.id, codeId))
  revalidatePath("/school")
  return { ok: true }
}

/**
 * Redeem a school invite code.
 *
 * Seat checks and the membership insert run inside one transaction with the
 * seat count taken under a row lock on the subscription, so two students
 * redeeming the last seat at the same moment cannot both succeed.
 */
export async function joinSchoolWithCode(formData: FormData) {
  const me = await requireUser()
  const raw = String(formData.get("code") || "")
    .trim()
    .toUpperCase()
  if (!raw) throw new Error("Enter an invite code")

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    const { rows: codeRows } = await client.query(
      `SELECT * FROM "invite_code" WHERE "code" = $1 FOR UPDATE`,
      [raw],
    )
    const invite = codeRows[0]
    if (!invite) throw new Error("That invite code is not valid")
    if (!invite.active) throw new Error("That invite code has been disabled")
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new Error("That invite code has expired")
    }
    if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
      throw new Error("That invite code has already been fully used")
    }

    // A teacher redeeming a student code would join as a student and lose
    // their classes' teacher access, so steer them to the right code.
    if (invite.role === "student" && me.role === "teacher") {
      throw new Error(
        "That's a student code. Ask your school administrator for a teacher code.",
      )
    }

    const { rows: memberRows } = await client.query(
      `SELECT * FROM "school_member" WHERE "userId" = $1 AND "status" = 'active'`,
      [me.id],
    )
    if (memberRows.length > 0) {
      if (memberRows[0].schoolId === invite.schoolId) {
        await client.query("COMMIT")
        return { ok: true, schoolId: invite.schoolId, alreadyMember: true }
      }
      throw new Error("You already belong to a different school")
    }

    // Lock the school's plan row so concurrent joins serialise behind it.
    const { rows: planRows } = await client.query(
      `SELECT * FROM "school_subscription" WHERE "schoolId" = $1 FOR UPDATE`,
      [invite.schoolId],
    )
    const plan = planRows[0]
    // Status alone can be stale, so the billing period is checked too —
    // otherwise students keep joining a school whose plan has lapsed.
    if (!plan || !isSubscriptionLive(plan.status, plan.currentPeriodEnd)) {
      throw new Error("This school does not have an active plan")
    }

    const limit =
      invite.role === "teacher" ? plan.teacherSeatLimit : plan.studentSeatLimit

    if (limit !== null && limit !== undefined) {
      // Admins teach too, so they occupy one of the teacher seats — this
      // matches the "x of y teachers" figure on the admin dashboard.
      const seatRoles = invite.role === "teacher" ? ["teacher", "school_admin"] : ["student"]
      const { rows: usedRows } = await client.query(
        `SELECT COUNT(*)::int AS used FROM "school_member"
         WHERE "schoolId" = $1 AND "status" = 'active' AND "role" = ANY($2::text[])`,
        [invite.schoolId, seatRoles],
      )
      if (usedRows[0].used >= limit) {
        throw new Error(
          invite.role === "teacher"
            ? "Your school has reached its teacher seat limit."
            : "Your school has reached its student seat limit.",
        )
      }
    }

    // Recording which code was redeemed is what lets an administrator see who
    // joined on a given code. Written in the same transaction as the seat
    // claim, so attribution can never drift from membership.
    await client.query(
      `INSERT INTO "school_member" ("schoolId", "userId", "role", "invitedByCodeId")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("schoolId", "userId")
       DO UPDATE SET "status" = 'active', "invitedByCodeId" = $4`,
      [invite.schoolId, me.id, invite.role, invite.id],
    )

    await client.query(
      `UPDATE "invite_code" SET "usedCount" = "usedCount" + 1 WHERE "id" = $1`,
      [invite.id],
    )

    await client.query("COMMIT")
    revalidatePath("/student")
    revalidatePath("/teacher")
    revalidatePath("/school")
    return { ok: true, schoolId: invite.schoolId as number, alreadyMember: false }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export type RemoveSchoolMemberResult =
  | { ok: true; alreadyRemoved: boolean; role: string }
  | { ok: false; message: string }

/**
 * Take a teacher or student out of a school.
 *
 * This ends one thing: the `school_member` row linking this person to this
 * school, which is set to "removed" rather than deleted. It is deliberately
 * not either of the two operations it is easily mistaken for:
 *
 * - It is not removing a student from a class. Enrolments are untouched; that
 *   is `removeStudentFromClass`, and belongs to the class teacher.
 * - It is not deleting an account. The user row, their login, their files,
 *   submissions, feedback, classes and library are never read or written here.
 *
 * Because only the row for this school is updated, nothing the person holds
 * anywhere else can be affected.
 *
 * Refusals are returned rather than thrown, so the confirmation dialog can
 * show the reason: a thrown Server Action error is redacted in production.
 */
export async function removeSchoolMember(
  schoolId: number,
  userId: string,
): Promise<RemoveSchoolMemberResult> {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return { ok: false, message: "School not found." }
  }
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, message: "That person could not be found." }
  }

  // Authority is established here, from the caller's own membership row, for
  // the school named in the request. An administrator of another school fails
  // this check however the request was built, and the confirmation dialog
  // plays no part in it.
  let admin: Awaited<ReturnType<typeof requireSchoolAdmin>>
  try {
    admin = await requireSchoolAdmin(schoolId)
  } catch {
    return { ok: false, message: "You don't have permission to manage this school." }
  }

  if (userId === admin.user.id) {
    return { ok: false, message: "You can't remove yourself from the school." }
  }

  const [member] = await db
    .select({ role: schoolMembers.role, status: schoolMembers.status })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.schoolId, admin.schoolId), eq(schoolMembers.userId, userId)))
    .limit(1)
  if (!member) {
    return { ok: false, message: "That person is not a member of this school." }
  }

  // The dashboard offers no way to remove an administrator, and the server
  // agrees with it: otherwise a hand-built request could leave a school with
  // nobody able to manage it.
  if (isSchoolAdminRole(member.role as Parameters<typeof isSchoolAdminRole>[0])) {
    return { ok: false, message: "A school administrator can't be removed here." }
  }

  // Conditional on the row still being active, so a double-click or a retry
  // changes nothing the second time and is reported as already done.
  const removed = await db
    .update(schoolMembers)
    .set({ status: "removed" })
    .where(
      and(
        eq(schoolMembers.schoolId, admin.schoolId),
        eq(schoolMembers.userId, userId),
        eq(schoolMembers.status, "active"),
      ),
    )
    .returning({ id: schoolMembers.id })

  revalidatePath("/school")
  revalidatePath("/teacher")
  revalidatePath("/student")
  return { ok: true, alreadyRemoved: removed.length === 0, role: member.role }
}

export async function getSchoolOverview() {
  const me = await requireUser()
  const entitlement = await getEntitlement(me.id)
  if (!entitlement.schoolId) return null

  const schoolId = entitlement.schoolId
  // Resolved through the shared admin-role list, so a new tier of administrator
  // is recognised here the moment it is added to SCHOOL_ADMIN_ROLES rather than
  // silently losing the member list, invite codes and billing controls.
  const isAdmin = isSchoolAdminRole(entitlement.schoolRole)

  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1)
  if (!school) return null

  const readPlan = async () =>
    (
      await db
        .select({
          tier: schoolSubscriptions.tier,
          status: schoolSubscriptions.status,
          interval: schoolSubscriptions.interval,
          teacherSeatLimit: schoolSubscriptions.teacherSeatLimit,
          studentSeatLimit: schoolSubscriptions.studentSeatLimit,
          currentPeriodEnd: schoolSubscriptions.currentPeriodEnd,
          cancelAtPeriodEnd: schoolSubscriptions.cancelAtPeriodEnd,
          stripeCustomerId: schoolSubscriptions.stripeCustomerId,
          stripeSubscriptionId: schoolSubscriptions.stripeSubscriptionId,
        })
        .from(schoolSubscriptions)
        .where(eq(schoolSubscriptions.schoolId, schoolId))
        .limit(1)
    )[0]

  let stored = await readPlan()

  // An administrator coming back from the Stripe portal has to see what they
  // just did — cancelled, resumed, changed tier — rather than whatever the last
  // webhook happened to leave behind. Re-reading Stripe here is what makes the
  // rest of this page verified state instead of a hopeful cache. Admins only:
  // they are the only ones who can have just changed something, and this costs
  // a round trip.
  if (isAdmin && stored?.stripeSubscriptionId) {
    if (await refreshSubscriptionFromStripe(stored.stripeSubscriptionId)) {
      stored = await readPlan()
    }
  }

  // The Stripe identifiers never leave the server: the dashboard only needs to
  // know whether a billing account exists, not what it is called.
  const plan = stored
    ? {
        tier: stored.tier,
        status: stored.status,
        // What this school actually renews on, so the upgrade tiles can quote
        // the amount it would really be charged rather than the tier default.
        interval: stored.interval,
        teacherSeatLimit: stored.teacherSeatLimit,
        studentSeatLimit: stored.studentSeatLimit,
        currentPeriodEnd: stored.currentPeriodEnd,
        cancelAtPeriodEnd: stored.cancelAtPeriodEnd,
        /**
         * Whether this plan can be managed through Stripe at all.
         *
         * A plan granted by hand — a pilot, a migrated school, an invoice paid
         * offline — is genuinely active and genuinely grants Pro, but has no
         * Stripe customer behind it, so the portal cannot open for it. The
         * dashboard reads this to decide between offering the control and
         * explaining why there isn't one, instead of rendering a button whose
         * only possible outcome is "No billing account found".
         */
        manageable: Boolean(stored.stripeCustomerId),
        /**
         * Whether this plan's tier can be moved in place.
         *
         * Deliberately a different question from `manageable`: opening the
         * portal needs a Stripe *customer*, while changing a tier edits the
         * *subscription*. A plan with a customer but no subscription — one
         * invoiced manually under an existing customer record — can open the
         * portal yet has nothing to re-price, so offering it an upgrade would
         * promise a change the server would then have to refuse.
         */
        tierChangeable: Boolean(stored.stripeSubscriptionId),
      }
    : null

  const seatRows = await db
    .select({ role: schoolMembers.role, used: count() })
    .from(schoolMembers)
    .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, "active")))
    .groupBy(schoolMembers.role)

  const seats = {
    teacher: seatRows.find((r) => r.role === "teacher")?.used ?? 0,
    student: seatRows.find((r) => r.role === "student")?.used ?? 0,
    admin: seatRows.find((r) => r.role === "school_admin")?.used ?? 0,
  }

  // Who is in the school, and its invite codes, are administrative data —
  // admins only.
  const roster = isAdmin ? await loadSchoolRoster(schoolId) : null

  // Each code carries the name of the administrator who issued it and how many
  // people are currently attributed to it, so the management view can be read
  // without a second round trip per code.
  const codes = isAdmin
    ? await db
        .select({
          id: inviteCodes.id,
          code: inviteCodes.code,
          role: inviteCodes.role,
          maxUses: inviteCodes.maxUses,
          usedCount: inviteCodes.usedCount,
          expiresAt: inviteCodes.expiresAt,
          active: inviteCodes.active,
          createdAt: inviteCodes.createdAt,
          createdByName: user.name,
          joinedCount: sql<number>`(
            SELECT COUNT(*)::int FROM "school_member" sm
            WHERE sm."invitedByCodeId" = ${inviteCodes.id}
              AND sm."status" = 'active'
          )`,
        })
        .from(inviteCodes)
        .leftJoin(user, eq(user.id, inviteCodes.createdBy))
        .where(eq(inviteCodes.schoolId, schoolId))
        .orderBy(sql`${inviteCodes.createdAt} desc`)
    : []

  return { school, plan, seats, roster, codes, isAdmin, entitlement }
}

/**
 * The school's teachers, and its classes with the students enrolled in each.
 *
 * Not exported, so it is not a callable action: the only way in is through
 * `getSchoolOverview`, which has already established that the caller
 * administers this school. Every query below is scoped to that one school id —
 * members by `school_member.schoolId`, classes by `class.schoolId`, enrolments
 * by those classes — so nothing from another school can be reached from here.
 */
async function loadSchoolRoster(schoolId: number) {
  const [members, schoolClasses] = await Promise.all([
    // Membership, not class ownership, is what makes someone a teacher of the
    // school: a teacher who has redeemed the invite code is listed whether or
    // not a class exists for them yet.
    db
      .select({
        userId: schoolMembers.userId,
        role: schoolMembers.role,
        joinedAt: schoolMembers.joinedAt,
        invitedByCodeId: schoolMembers.invitedByCodeId,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      })
      .from(schoolMembers)
      .innerJoin(user, eq(user.id, schoolMembers.userId))
      .where(and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, "active"))),
    // A personal workspace is modelled as a class but is one learner's private
    // storage, so it is never a class of the school.
    db
      .select({
        id: classes.id,
        name: classes.name,
        teacherId: classes.teacherId,
        teacherName: user.name,
      })
      .from(classes)
      .leftJoin(user, eq(user.id, classes.teacherId))
      .where(and(eq(classes.schoolId, schoolId), eq(classes.isPersonal, false))),
  ])

  const classIds = schoolClasses.map((cls) => cls.id)
  const enrolments = classIds.length
    ? await db
        .select({
          classId: enrollments.classId,
          studentId: enrollments.studentId,
          name: user.name,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        })
        .from(enrollments)
        .innerJoin(user, eq(user.id, enrollments.studentId))
        .where(inArray(enrollments.classId, classIds))
    : []

  return buildSchoolRoster({ members, classes: schoolClasses, enrolments })
}


