-- Remembers that a user has already made their first-run choice, so the
-- welcome screen is shown once and never again. Idempotent: safe to re-run.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboardedAt" timestamp;

-- Accounts that existed before this feature already know their way around, so
-- they are treated as onboarded. Accounts created today are left alone: they
-- are the fresh test sign-ups that should still see the welcome screen.
UPDATE "user"
SET "onboardedAt" = now()
WHERE "onboardedAt" IS NULL
  AND "createdAt" < date_trunc('day', now());
