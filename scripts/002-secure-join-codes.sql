-- Secure class join codes: durable throttling, optional expiry, lookup indexes.
--   node --env-file-if-exists=/vercel/share/.env.project scripts/run-sql.mjs scripts/002-secure-join-codes.sql

-- Failed join attempts, recorded durably so the throttle survives cold starts
-- and is shared across serverless instances. An in-memory counter resets on
-- every new lambda, so it cannot bound a distributed brute-force attempt.
CREATE TABLE IF NOT EXISTS "join_attempt" (
  "id" serial PRIMARY KEY,
  "bucket" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- The throttle only ever asks "how many failures in this bucket since T".
CREATE INDEX IF NOT EXISTS "join_attempt_bucket_created_idx"
  ON "join_attempt" ("bucket", "createdAt" DESC);

-- Optional expiry for a class join code. NULL means the code does not expire,
-- which keeps every existing class behaving exactly as it does today.
ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "joinCodeExpiresAt" timestamp;

-- joinClass resolves the caller's school membership on every attempt.
CREATE INDEX IF NOT EXISTS "school_member_user_status_idx"
  ON "school_member" ("userId", "status");

-- Enrollment is checked per student on join and on every workspace load.
CREATE INDEX IF NOT EXISTS "enrollment_student_idx" ON "enrollment" ("studentId");

-- NOTE: "class"."joinCode" already carries a UNIQUE constraint
-- (class_joinCode_key), which is what guarantees code uniqueness at the
-- database level rather than in application code. Verified present; not
-- recreated here.
