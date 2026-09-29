-- ─────────────────────────────────────────────────────────────────────────────
-- Arete — user_meta: the key/value store behind settings, the saved meal plan,
-- overload exercises, split names, water profile and every other useDocument.
--
-- The app has always depended on this table but the repo never defined it, so a
-- fresh Supabase project would have no settings sync. This file defines it.
--
-- ADDITIVE AND IDEMPOTENT: creates what is missing, changes nothing that exists,
-- and never deletes or rewrites a row. Safe to run repeatedly in the SQL Editor.
--
--   user_id (text) · key (text) · value (jsonb) · updated_at (timestamptz)
--   unique (user_id, key)  ← required by the app's upsert(onConflict: 'user_id,key')
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_meta (
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Older projects may have created the table without updated_at.
ALTER TABLE public.user_meta ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- One document per (user, key). If this fails with "could not create unique
-- index", duplicate (user_id, key) rows exist: inspect them with
--   SELECT user_id, key, count(*) FROM public.user_meta GROUP BY 1, 2 HAVING count(*) > 1;
-- and decide which to keep. This script deliberately does not delete anything.
CREATE UNIQUE INDEX IF NOT EXISTS user_meta_user_key_uidx ON public.user_meta (user_id, key);

ALTER TABLE public.user_meta ENABLE ROW LEVEL SECURITY;

-- Owner-only, same rule as every other table (see sync_all_tables.sql).
DROP POLICY IF EXISTS user_meta_owner ON public.user_meta;
CREATE POLICY user_meta_owner ON public.user_meta
  FOR ALL
  USING      (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Keep updated_at honest on every write.
CREATE OR REPLACE FUNCTION public.user_meta_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_meta_touch ON public.user_meta;
CREATE TRIGGER user_meta_touch BEFORE INSERT OR UPDATE ON public.user_meta
  FOR EACH ROW EXECUTE FUNCTION public.user_meta_touch();

-- Realtime, so a settings change on one device reaches the others.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_meta;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already published
END $$;
