-- Folders inside folders.
--
-- A folder now points at the folder that contains it. Null means it sits at
-- the top level, which is where every existing folder already is, so nothing
-- is backfilled and every tree looks the same after this migration as before.
--
-- The column is added to both sides on purpose: a pupil's own folders and a
-- teacher's library folders nest the same way, which is what lets a library
-- folder be handed to a class with its whole structure intact.
--
-- There is no per-IDE column or table here. Nesting hangs off the folder row,
-- which already carries its `language`, so an IDE added later gets nested
-- folders without another migration.

ALTER TABLE "student_folder"
  ADD COLUMN IF NOT EXISTS "parentId" integer;

ALTER TABLE "library_folder"
  ADD COLUMN IF NOT EXISTS "parentId" integer;

COMMENT ON COLUMN "student_folder"."parentId" IS
  'The student_folder this one sits inside. Null = top level of the class.';

COMMENT ON COLUMN "library_folder"."parentId" IS
  'The library_folder this one sits inside. Null = top level of the library.';
