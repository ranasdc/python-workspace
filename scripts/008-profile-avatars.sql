-- Profile avatars.
--
-- A single nullable column on the existing user record. It holds a catalogue
-- key such as 'robo-coder', never a URL and never image data, so the user
-- table stays small and the artwork behind any id can be replaced without
-- rewriting a single row.
--
-- Null is a valid, permanent state: it means "has not chosen", and the app
-- resolves it to a stable avatar derived from the user id. That is why there
-- is no default here and no backfill below — nothing needs migrating, and a
-- user who never opens the picker still has a picture.
--
-- Idempotent so it is safe to re-run.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "avatarId" text;
