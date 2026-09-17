import "server-only"

import { pool } from "@/lib/db"

// Per-instance sliding window. Good enough to stop a single account draining
// the AI budget; swap for Upstash Redis if this ever needs to hold across
// multiple serverless instances.

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key) ?? { hits: [] }

  bucket.hits = bucket.hits.filter((t) => now - t < windowMs)

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket)
    const retryAfterMs = windowMs - (now - bucket.hits[0])
    return { ok: false as const, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }

  return { ok: true as const, remaining: limit - bucket.hits.length }
}

// ---------- Durable throttle (join codes) ----------

// A join code is a bearer credential, so its throttle is a security control
// rather than a cost guard and cannot live in per-instance memory: each
// serverless instance would keep its own counter and a cold start would reset
// it, letting an attacker spread guesses across instances for free. Postgres is
// already a required dependency here, so it holds the counter — no extra
// service to provision. If join traffic ever outgrows a row insert per failed
// attempt, move these three functions to Upstash Redis (@upstash/ratelimit,
// sliding window) and keep the call sites unchanged.

/** Only failures are recorded, so a correct code never spends the budget. */
export async function countRecentFailures(bucket: string, windowSeconds: number) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "join_attempt"
      WHERE "bucket" = $1 AND "createdAt" > now() - make_interval(secs => $2)`,
    [bucket, windowSeconds],
  )
  return rows[0]?.n ?? 0
}

export async function recordFailures(buckets: string[]) {
  const unique = [...new Set(buckets)]
  if (unique.length === 0) return

  await pool.query(
    `INSERT INTO "join_attempt" ("bucket") SELECT unnest($1::text[])`,
    [unique],
  )

  // Bounded, deterministic cleanup: rows older than any window we enforce are
  // dead weight, and pruning only the buckets we just touched keeps this O(1).
  await pool.query(
    `DELETE FROM "join_attempt"
      WHERE "bucket" = ANY($1::text[]) AND "createdAt" < now() - interval '1 day'`,
    [unique],
  )
}

/**
 * Clearing on success stops a pupil who mistyped a few times from staying
 * throttled once they prove they hold a real code. Safe because possession of
 * a valid code is exactly what the throttle exists to test for.
 */
export async function clearFailures(bucket: string) {
  await pool.query(`DELETE FROM "join_attempt" WHERE "bucket" = $1`, [bucket])
}
