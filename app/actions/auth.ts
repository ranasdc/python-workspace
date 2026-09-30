"use server"

import { headers } from "next/headers"

import { pool } from "@/lib/db"
import { rateLimit } from "@/lib/rate-limit"

export type ExistingAccountRole = "student" | "teacher" | null

export async function checkExistingAccount(email: string): Promise<ExistingAccountRole> {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : ""
  if (!normalized || normalized.length > 254 || !normalized.includes("@")) return null

  const h = await headers()
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
  if (!rateLimit(`signup-check:${ip}`, 20, 60_000).ok) return null

  // Mirrors getEntitlement: school teachers/admins keep role "student" on the
  // user row, so an active teacher-level school membership also counts.
  const { rows } = await pool.query<{ role: string | null; school_teacher: boolean }>(
    `select u.role,
            exists (
              select 1 from school_member m
              where m."userId" = u.id
                and m.status = 'active'
                and m.role in ('teacher', 'school_admin')
            ) as school_teacher
     from "user" u
     where lower(u.email) = $1
     limit 1`,
    [normalized],
  )
  if (rows.length === 0) return null
  const { role, school_teacher } = rows[0]
  return role === "teacher" || school_teacher ? "teacher" : "student"
}
