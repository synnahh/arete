-- ─────────────────────────────────────────────────────────────────────────────
-- LM (Looksmaxxing OS) — Supabase tables
-- Run this in the Supabase SQL Editor to enable cross-device sync for the LM tab.
-- Until run, the tab still works fully via localStorage (useCollection / useDocument
-- fall back to local storage). lm_profile is stored in the existing user_meta table,
-- so no table is needed for it.
--
-- Every table matches the existing VALERIE collection shape:
--   id (uuid), user_id (text), data (jsonb), created_at (timestamptz)
-- with RLS scoping rows to the signed-in user (same policy as portfolio_holdings).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lm_metrics', 'lm_strength', 'lm_daily', 'lm_sleep', 'lm_nutrition',
    'lm_skin', 'lm_haircuts', 'lm_products', 'lm_fragrances', 'lm_wardrobe',
    'lm_outfits', 'lm_posture', 'lm_social', 'lm_photos', 'lm_experiments'
  ]
  LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS public.%I (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    TEXT NOT NULL,
        data       JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    $f$, t);

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
    $f$, t || '_owner', t);

    -- Realtime: useCollection subscribes to postgres_changes on each table
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
  END LOOP;
END $$;
