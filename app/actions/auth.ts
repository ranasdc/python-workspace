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

  const { rows } = await pool.query<{ role: string | null }>(
    `select role from "user" where lower(email) = $1 limit 1`,
    [normalized],
  )
  if (rows.length === 0) return null
  return rows[0].role === "student" ? "student" : "teacher"
}
