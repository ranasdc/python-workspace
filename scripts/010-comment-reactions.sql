-- Pupil replies to teacher feedback.
--
-- A comment could previously only be read, so a teacher had no way to tell a
-- pupil who had acted on feedback from one who had never seen it. These two
-- columns let a pupil answer with one tap -- acknowledged, made correction, or
-- need help on this -- and let that answer show up on the teacher's side.
--
-- Two additive, nullable columns. Null means "not answered yet", which is the
-- correct and permanent state for every comment that already exists, so there
-- is nothing to backfill.
--
-- "studentReaction" holds one of a small fixed set of ids, validated in the
-- server action against lib/ide/comment-reactions.ts before it is ever written.
-- It is kept as text rather than a Postgres enum so adding a fourth reply later
-- is a code change rather than a migration against a live table.
--
-- "studentReactedAt" records when the pupil last answered. It is set alongside
-- the reaction and cleared with it, so a teacher can see whether a pupil replied
-- immediately or days later -- useful when the reply is "need help on this".
--
-- Idempotent so it is safe to re-run.

ALTER TABLE "file_comment" ADD COLUMN IF NOT EXISTS "studentReaction" text;
ALTER TABLE "file_comment" ADD COLUMN IF NOT EXISTS "studentReactedAt" timestamp;
