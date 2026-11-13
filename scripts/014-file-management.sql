-- Renaming and withdrawing distributed files and folders.
--
-- Purely additive: three nullable columns and two indexes. No row is deleted,
-- no existing value is changed, and every tree reads the same after this
-- migration as before it.
--
-- 1. "withdrawnAt" marks a pupil's copy that the teacher has taken back by
--    deleting the original from their library. The row and the pupil's work in
--    it are kept; it is simply no longer shown. Null = live, which is what
--    every existing row is.
--
-- 2. "sourceLibraryFolderId" does for folders what "sourceLibraryFileId"
--    already does for files: it records which library folder a pupil's folder
--    is a copy of, so renaming or deleting the original can find every copy
--    without guessing from its name.

ALTER TABLE "code_file"
  ADD COLUMN IF NOT EXISTS "withdrawnAt" timestamp;

ALTER TABLE "student_folder"
  ADD COLUMN IF NOT EXISTS "withdrawnAt" timestamp;

ALTER TABLE "student_folder"
  ADD COLUMN IF NOT EXISTS "sourceLibraryFolderId" integer;

COMMENT ON COLUMN "code_file"."withdrawnAt" IS
  'Set when the teacher deleted the library file this copy came from. The row is kept but hidden. Null = live.';

COMMENT ON COLUMN "student_folder"."withdrawnAt" IS
  'Set when the teacher deleted the library folder this copy came from. The row is kept but hidden. Null = live.';

COMMENT ON COLUMN "student_folder"."sourceLibraryFolderId" IS
  'The library_folder this folder is a distributed copy of. Null for a pupil''s own folders.';

CREATE INDEX IF NOT EXISTS "code_file_source_library_file_idx"
  ON "code_file" ("sourceLibraryFileId")
  WHERE "sourceLibraryFileId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "student_folder_source_library_folder_idx"
  ON "student_folder" ("sourceLibraryFolderId")
  WHERE "sourceLibraryFolderId" IS NOT NULL;

-- Link the folders that were distributed before the column existed.
--
-- A distributed folder holds copies of the files in its library folder, and
-- those copies already point at their originals. So a pupil's folder is a copy
-- of library folder X when every distributed file in it came from X. The names
-- must match as well: neither side could be renamed before this migration, so
-- a mismatch means the link cannot be trusted and the folder is left unlinked.
UPDATE "student_folder" AS sf
SET "sourceLibraryFolderId" = matched."libraryFolderId"
FROM (
  SELECT cf."folderId" AS "copyId", MIN(lf."folderId") AS "libraryFolderId"
  FROM "code_file" cf
  JOIN "library_file" lf ON lf."id" = cf."sourceLibraryFileId"
  WHERE cf."assignedByTeacher" = true
    AND cf."folderId" IS NOT NULL
    AND lf."folderId" IS NOT NULL
  GROUP BY cf."folderId"
  HAVING COUNT(DISTINCT lf."folderId") = 1
) AS matched
JOIN "library_folder" origin ON origin."id" = matched."libraryFolderId"
WHERE sf."id" = matched."copyId"
  AND sf."assignedByTeacher" = true
  AND sf."sourceLibraryFolderId" IS NULL
  AND sf."name" = origin."name";

-- Folders that hold only other folders have no file to identify them, so they
-- are linked through their place in the tree instead: upwards from a linked
-- folder to its parent, and downwards from a linked folder to its children.
-- Trees are at most five levels deep, so four passes each way reach them all.
DO $$
BEGIN
  FOR pass IN 1..4 LOOP
    UPDATE "student_folder" AS parent
    SET "sourceLibraryFolderId" = origin_parent."id"
    FROM "student_folder" child
    JOIN "library_folder" origin_child ON origin_child."id" = child."sourceLibraryFolderId"
    JOIN "library_folder" origin_parent ON origin_parent."id" = origin_child."parentId"
    WHERE child."parentId" = parent."id"
      AND parent."assignedByTeacher" = true
      AND parent."sourceLibraryFolderId" IS NULL
      AND parent."name" = origin_parent."name";

    UPDATE "student_folder" AS child
    SET "sourceLibraryFolderId" = origin_child."id"
    FROM "student_folder" parent
    JOIN "library_folder" origin_child ON origin_child."parentId" = parent."sourceLibraryFolderId"
    WHERE child."parentId" = parent."id"
      AND child."assignedByTeacher" = true
      AND child."sourceLibraryFolderId" IS NULL
      AND child."name" = origin_child."name";
  END LOOP;
END $$;
