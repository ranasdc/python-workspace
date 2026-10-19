-- Public share links.
--
-- The previous "copy link" was a deep link into the app: it carried a file id
-- and still went through the session and ownership checks, so it only ever
-- worked for someone who could already open the file. This table replaces it
-- with a real public link -- openable by anyone, no account needed.
--
-- "token" is the whole access control story, so it is 128 bits of randomness
-- rather than anything derived from the row. A serial id or a short code would
-- be enumerable, and enumerable means every shared file in the product is one
-- loop away from being scraped.
--
-- One row per file, enforced by the unique index on (sourceKind, sourceFileId).
-- Pressing Share twice therefore hands back the same link instead of minting a
-- second one, so a link already given out keeps working and "stop sharing"
-- really does revoke every copy of it.
--
-- "sourceKind" names which table "sourceFileId" points into -- "code" for a
-- pupil's own file, "library" for a teacher's library file. There is no foreign
-- key because the target depends on the kind; a share whose file has since been
-- deleted simply resolves to nothing and the page 404s.
--
-- Revocation is a timestamp rather than a DELETE so a withdrawn link stays
-- distinguishable from one that never existed, which is what lets the same
-- row be re-published later without changing the token.
--
-- Idempotent so it is safe to re-run.

CREATE TABLE IF NOT EXISTS "file_share" (
  "id" serial PRIMARY KEY,
  "token" text NOT NULL UNIQUE,
  "sourceKind" text NOT NULL,
  "sourceFileId" integer NOT NULL,
  "ownerId" text NOT NULL,
  "revokedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "file_share_source_idx"
  ON "file_share" ("sourceKind", "sourceFileId");

-- Every owner-facing read is "has this user shared anything / this file", so
-- the owner column carries its own index.
CREATE INDEX IF NOT EXISTS "file_share_owner_idx" ON "file_share" ("ownerId");
