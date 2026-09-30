import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const statements = [
  `ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "aiHelpEnabled" boolean NOT NULL DEFAULT true`,
  `ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "aiHelpDelayMinutes" integer NOT NULL DEFAULT 10`,
  `CREATE TABLE IF NOT EXISTS "ai_help_unlock" (
    "id" serial PRIMARY KEY,
    "studentId" text NOT NULL,
    "fileId" integer NOT NULL,
    "signature" text NOT NULL,
    "unlockAt" timestamp NOT NULL,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    UNIQUE ("studentId", "fileId", "signature")
  )`,
  `CREATE TABLE IF NOT EXISTS "daily_starter" (
    "id" serial PRIMARY KEY,
    "classId" integer NOT NULL,
    "teacherId" text NOT NULL,
    "title" text NOT NULL,
    "topic" text NOT NULL DEFAULT '',
    "language" text NOT NULL DEFAULT 'python',
    "difficulty" text NOT NULL DEFAULT 'mixed',
    "yearGroup" text NOT NULL DEFAULT '',
    "objective" text NOT NULL DEFAULT '',
    "starterDate" text NOT NULL,
    "timeLimitSeconds" integer NOT NULL DEFAULT 300,
    "allowRetake" boolean NOT NULL DEFAULT false,
    "questions" jsonb NOT NULL,
    "status" text NOT NULL DEFAULT 'draft',
    "aiGenerated" boolean NOT NULL DEFAULT false,
    "warmupIndex" integer NOT NULL DEFAULT 0,
    "warmupRevealed" boolean NOT NULL DEFAULT false,
    "warmupActive" boolean NOT NULL DEFAULT false,
    "createdAt" timestamp NOT NULL DEFAULT now(),
    "updatedAt" timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "daily_starter_class_idx" ON "daily_starter" ("classId", "starterDate")`,
  `CREATE TABLE IF NOT EXISTS "daily_starter_response" (
    "id" serial PRIMARY KEY,
    "starterId" integer NOT NULL,
    "studentId" text NOT NULL,
    "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "score" integer,
    "total" integer,
    "startedAt" timestamp NOT NULL DEFAULT now(),
    "submittedAt" timestamp,
    UNIQUE ("starterId", "studentId")
  )`,
]

try {
  for (const sql of statements) await pool.query(sql)
  console.log("migration ok")
} finally {
  await pool.end()
}
