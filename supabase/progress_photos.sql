-- ─────────────────────────────────────────────────────────────────────────────
-- Arete — progress photos: metadata table + private Storage bucket.
--
-- The image files live in the PRIVATE bucket `progress-photos`, one folder per
-- user (`<auth uid>/<date>-<pose>-<id>.jpg`). Only the signed-in owner can read,
-- write or delete objects in their own folder; there is no public URL.
-- The table `progress_photos` holds only metadata (date, pose, path, size), in
-- the same shape as every other collection: id · user_id · data · created_at.
--
-- ADDITIVE AND IDEMPOTENT: creates what is missing, never deletes or rewrites a
-- row or object. Safe to run repeatedly in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.progress_photos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progress_photos_owner ON public.progress_photos;
CREATE POLICY progress_photos_owner ON public.progress_photos
  FOR ALL
  USING      (user_id = current_setting('request.jwt.claims', true)::json->>'sub')
  WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.progress_photos;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Private bucket, 10 MB per file, images only (the app sends ~200-500 KB JPEGs).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('progress-photos', 'progress-photos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Owner-only access, scoped to the user's own folder.
DROP POLICY IF EXISTS progress_photos_obj_select ON storage.objects;
CREATE POLICY progress_photos_obj_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS progress_photos_obj_insert ON storage.objects;
CREATE POLICY progress_photos_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS progress_photos_obj_delete ON storage.objects;
CREATE POLICY progress_photos_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
