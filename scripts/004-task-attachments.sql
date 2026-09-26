-- Optional tasks attached to a library file, plus AI generation usage metering.
-- Idempotent so it is safe to re-run.

ALTER TABLE "code_file" ADD COLUMN IF NOT EXISTS "sourceLibraryFileId" integer;

CREATE TABLE IF NOT EXISTS "file_task" (
  "id" serial PRIMARY KEY,
  "libraryFileId" integer NOT NULL UNIQUE,
  "teacherId" text NOT NULL,
  "title" text NOT NULL,
  "instructions" text NOT NULL,
  "topic" text,
  "difficulty" text,
  "yearGroup" text,
  "learningObjective" text,
  "origin" text NOT NULL DEFAULT 'manual',
  "version" integer NOT NULL DEFAULT 1,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "file_task_teacher_idx" ON "file_task" ("teacherId");

CREATE TABLE IF NOT EXISTS "ai_task_usage" (
  "id" serial PRIMARY KEY,
  "teacherId" text NOT NULL,
  "schoolId" integer,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Monthly usage is counted per account, so index the columns the count filters on.
CREATE INDEX IF NOT EXISTS "ai_task_usage_teacher_idx" ON "ai_task_usage" ("teacherId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_task_usage_school_idx" ON "ai_task_usage" ("schoolId", "createdAt");

-- Distributed copies can be linked back to their source for faster task lookups.
CREATE INDEX IF NOT EXISTS "code_file_source_idx" ON "code_file" ("sourceLibraryFileId");
