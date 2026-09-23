-- Multi-language IDE support.
--
-- Every existing row predates the HTML IDE and is therefore Python work. The
-- NOT NULL DEFAULT 'python' backfills them in place, so the Python IDE shows
-- exactly the same tree after this migration as before it.

ALTER TABLE "code_file"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'python';

ALTER TABLE "student_folder"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'python';

ALTER TABLE "library_file"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'python';

ALTER TABLE "library_folder"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'python';

-- Last IDE the user had open. Nullable: null simply means "never chose",
-- which resolves to the platform default at read time.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "lastIde" text;

-- Every student-facing read filters by (owner, class, language), and the
-- teacher dashboard by (class, language). These indexes keep those scoped
-- reads cheap now that language is always part of the predicate.
CREATE INDEX IF NOT EXISTS "code_file_student_language_idx"
  ON "code_file" ("studentId", "classId", "language");

CREATE INDEX IF NOT EXISTS "code_file_class_language_idx"
  ON "code_file" ("classId", "language");

CREATE INDEX IF NOT EXISTS "student_folder_student_language_idx"
  ON "student_folder" ("studentId", "classId", "language");

CREATE INDEX IF NOT EXISTS "library_file_teacher_language_idx"
  ON "library_file" ("teacherId", "language");

CREATE INDEX IF NOT EXISTS "library_folder_teacher_language_idx"
  ON "library_folder" ("teacherId", "language");
