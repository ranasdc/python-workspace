-- Teacher-only model solutions on an attached task, plus the AI authoring
-- metadata the Create Task workspace records. Idempotent so it is safe to
-- re-run.
--
-- Nothing here is ever read by a student path: the two student-facing reads
-- (getTaskForStudentFile, and the task columns joined into listFiles) select
-- an explicit column list, so a new column is invisible to them by default
-- rather than by omission.

ALTER TABLE "file_task" ADD COLUMN IF NOT EXISTS "solution" text;

-- "ai" | "teacher" | "teacher_edited" — who wrote the stored solution.
ALTER TABLE "file_task" ADD COLUMN IF NOT EXISTS "solutionSource" text;

ALTER TABLE "file_task" ADD COLUMN IF NOT EXISTS "solutionUpdatedAt" timestamp;

-- Normalised snapshot of the task text the solution was written against.
-- Comparing it with the current task is what lets the workspace warn that an
-- edit may have left the solution behind.
ALTER TABLE "file_task" ADD COLUMN IF NOT EXISTS "solutionFingerprint" text;

-- True once AI has rewritten the instructions, independently of "origin":
-- a teacher-written task that was refined stays origin='manual'.
ALTER TABLE "file_task" ADD COLUMN IF NOT EXISTS "aiRefined" boolean NOT NULL DEFAULT false;
