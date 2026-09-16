import "server-only"

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
