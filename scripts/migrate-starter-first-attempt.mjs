import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

await pool.query(`
  ALTER TABLE daily_starter_response
    ADD COLUMN IF NOT EXISTS "firstAnswers" jsonb,
    ADD COLUMN IF NOT EXISTS "firstScore" integer,
    ADD COLUMN IF NOT EXISTS "firstTotal" integer,
    ADD COLUMN IF NOT EXISTS "firstSubmittedAt" timestamp
`)

// Existing submissions are treated as the student's first attempt.
const { rowCount } = await pool.query(`
  UPDATE daily_starter_response
  SET "firstAnswers" = answers, "firstScore" = score, "firstTotal" = total, "firstSubmittedAt" = "submittedAt"
  WHERE "submittedAt" IS NOT NULL AND "firstSubmittedAt" IS NULL
`)

console.log(`first-attempt columns ready; backfilled ${rowCount} submissions`)
await pool.end()
