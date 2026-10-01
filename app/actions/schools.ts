"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"

import { MAX_INVITE_DAYS, MAX_INVITE_USES } from "@/lib/invite-codes"
import { and, count, eq, sql } from "drizzle-orm"

import { db, pool } from "@/lib/db"
import {
  inviteCodes,
  schoolMembers,
  schoolSubscriptions,
  schools,
  user,
} from "@/lib/db/schema"
import { requireUser } from "@/lib/session"
import { getEntitlement, isSubscriptionLive, requireSchoolAdmin } from "@/lib/entitlements"

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

export async function removeSchoolMember(schoolId: number, userId: string) {
  const admin = await requireSchoolAdmin(schoolId)
  if (userId === admin.user.id) throw new Error("You cannot remove yourself")

  await db
    .update(schoolMembers)
    .set({ status: "removed" })
    .where(
      and(eq(schoolMembers.schoolId, admin.schoolId), eq(schoolMembers.userId, userId)),
    )

  revalidatePath("/school")
  return { ok: true }
}

export async function getSchoolOverview() {
  const me = await requireUser()
  const entitlement = await getEntitlement(me.id)
  if (!entitlement.schoolId) return null

  const schoolId = entitlement.schoolId
  const isAdmin = entitlement.schoolRole === "school_admin"

  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1)
  if (!school) return null

  const [plan] = await db
    .select()
    .from(schoolSubscriptions)
    .where(eq(schoolSubscriptions.schoolId, schoolId))
    .limit(1)

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

  // Member list and invite codes are administrative data — admins only.
  const members = isAdmin
    ? await db
        .select({
          userId: schoolMembers.userId,
          role: schoolMembers.role,
          joinedAt: schoolMembers.joinedAt,
          name: user.name,
          email: user.email,
        })
        .from(schoolMembers)
        .innerJoin(user, eq(user.id, schoolMembers.userId))
        .where(
          and(eq(schoolMembers.schoolId, schoolId), eq(schoolMembers.status, "active")),
        )
        .orderBy(schoolMembers.role, user.name)
    : []

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

  return { school, plan: plan ?? null, seats, members, codes, isAdmin, entitlement }
}


