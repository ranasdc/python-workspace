-- Teacher corrections on student code.
--
-- A teacher can now edit a pupil's file directly. Every correction is
-- attributed rather than silent, which is the entire point: the pupil must be
-- able to tell that the code in front of them is no longer only their own.
--
-- Five additive, nullable columns on the existing row. Null across all of them
-- is the permanent, normal state meaning "never corrected", so there is nothing
-- to backfill and every existing file keeps working untouched.
--
-- "teacherEditedByName" is denormalised deliberately, matching file_comment:
-- the attribution on a correction should survive the teacher later leaving the
-- school and their user row going away.
--
-- "teacherEditedLines" holds 1-based line numbers as a JSON array. It is
-- cleared the moment the pupil edits again, because their own edit shifts the
-- lines and a stale highlight would point at innocent code. The attribution
-- columns deliberately survive that clear: the fact of a correction is
-- permanent, only the line-level marks are transient.
--
-- "studentContentBeforeEdit" keeps the pupil's own version from immediately
-- before the correction, so a teacher can never destroy a pupil's work -- it
-- can always be restored.
--
-- Idempotent so it is safe to re-run.

ALTER TABLE "code_file" ADD COLUMN IF NOT EXISTS "teacherEditedAt" timestamp;
ALTER TABLE "code_file" ADD COLUMN IF NOT EXISTS "teacherEditedBy" text;
ALTER TABLE "code_file" ADD COLUMN IF NOT EXISTS "teacherEditedByName" text;
ALTER TABLE "code_file" ADD COLUMN IF NOT EXISTS "teacherEditedLines" text;
ALTER TABLE "code_file" ADD COLUMN IF NOT EXISTS "studentContentBeforeEdit" text;
