-- Schools, memberships, invite codes and subscriptions.
-- Idempotent: safe to run more than once.

-- ---------- class: school ownership + personal workspace flag ----------
ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "schoolId" integer;
ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "isPersonal" boolean NOT NULL DEFAULT false;
ALTER TABLE "class" ADD COLUMN IF NOT EXISTS "joinCodeActive" boolean NOT NULL DEFAULT true;

-- ---------- school ----------
CREATE TABLE IF NOT EXISTS "school" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "createdBy" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "class"
  DROP CONSTRAINT IF EXISTS "class_schoolId_school_id_fk";
ALTER TABLE "class"
  ADD CONSTRAINT "class_schoolId_school_id_fk"
  FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE SET NULL;

-- ---------- school_member ----------
CREATE TABLE IF NOT EXISTS "school_member" (
  "id" serial PRIMARY KEY,
  "schoolId" integer NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'student',
  "status" text NOT NULL DEFAULT 'active',
  "joinedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "school_member_schoolId_userId_unique" UNIQUE ("schoolId", "userId")
);

CREATE INDEX IF NOT EXISTS "school_member_userId_idx" ON "school_member" ("userId");

-- ---------- invite_code ----------
CREATE TABLE IF NOT EXISTS "invite_code" (
  "id" serial PRIMARY KEY,
  "schoolId" integer NOT NULL REFERENCES "school"("id") ON DELETE CASCADE,
  "code" text NOT NULL UNIQUE,
  "role" text NOT NULL DEFAULT 'student',
  "maxUses" integer,
  "usedCount" integer NOT NULL DEFAULT 0,
  "expiresAt" timestamp,
  "active" boolean NOT NULL DEFAULT true,
  "createdBy" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- ---------- subscription (individual) ----------
CREATE TABLE IF NOT EXISTS "subscription" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "plan" text NOT NULL,
  "status" text NOT NULL DEFAULT 'inactive',
  "interval" text,
  "stripeCustomerId" text,
  "stripeSubscriptionId" text UNIQUE,
  "stripePriceId" text,
  "currentPeriodEnd" timestamp,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- ---------- school_subscription ----------
CREATE TABLE IF NOT EXISTS "school_subscription" (
  "id" serial PRIMARY KEY,
  "schoolId" integer NOT NULL UNIQUE REFERENCES "school"("id") ON DELETE CASCADE,
  "tier" text NOT NULL,
  "status" text NOT NULL DEFAULT 'inactive',
  "teacherSeatLimit" integer,
  "studentSeatLimit" integer,
  "stripeCustomerId" text,
  "stripeSubscriptionId" text UNIQUE,
  "stripePriceId" text,
  "currentPeriodEnd" timestamp,
  "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- ---------- stripe_event (webhook idempotency) ----------
CREATE TABLE IF NOT EXISTS "stripe_event" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "processedAt" timestamp NOT NULL DEFAULT now()
);

-- ---------- backfill ----------

-- A class whose teacher is also its only enrolled student is a personal
-- workspace. Flagging them stops their join codes working as real class codes.
UPDATE "class" c
SET "isPersonal" = true
WHERE c."isPersonal" = false
  AND EXISTS (
    SELECT 1 FROM "enrollment" e
    WHERE e."classId" = c."id" AND e."studentId" = c."teacherId"
  );

-- Carry any previously "paid" users over to the new subscription table so
-- nobody loses access during the migration.
INSERT INTO "subscription" ("userId", "plan", "status", "interval")
SELECT
  u."id",
  CASE WHEN u."role" = 'teacher' THEN 'teacher_pro' ELSE 'student_pro' END,
  'active',
  CASE WHEN u."subscriptionStatus" = 'yearly' THEN 'year' ELSE 'month' END
FROM "user" u
WHERE u."subscriptionStatus" IS NOT NULL
  AND u."subscriptionStatus" NOT IN ('free', '')
ON CONFLICT ("userId") DO NOTHING;
