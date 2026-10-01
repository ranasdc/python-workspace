-- Records which invite code a school member redeemed, so an administrator can
-- see who actually joined on each code. Idempotent: safe to re-run.
--
-- Deliberately nullable with no foreign key cascade behaviour beyond SET NULL:
-- revoking or deleting a code must never remove a teacher from the school.

ALTER TABLE "school_member"
  ADD COLUMN IF NOT EXISTS "invitedByCodeId" integer;

DO $$
BEGIN
  ALTER TABLE "school_member"
    ADD CONSTRAINT "school_member_invitedByCodeId_fkey"
    FOREIGN KEY ("invitedByCodeId") REFERENCES "invite_code"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "school_member_invitedByCodeId_idx"
  ON "school_member" ("invitedByCodeId");

-- Existing members joined before attribution was recorded, so their row stays
-- NULL and the UI reports the count as "not recorded" rather than zero.
