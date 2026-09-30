import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `CREATE TABLE IF NOT EXISTS "daily_starter_open" (
    "id" serial PRIMARY KEY,
    "starterId" integer NOT NULL,
    "studentId" text NOT NULL,
    "openedAt" timestamp NOT NULL DEFAULT now(),
    UNIQUE ("starterId", "studentId")
  )`,
  `CREATE INDEX IF NOT EXISTS "daily_starter_open_student_idx" ON "daily_starter_open" ("studentId")`,
]

try {
  for (const sql of statements) await pool.query(sql)
  console.log("daily_starter_open ready")
} finally {
  await pool.end()
}
