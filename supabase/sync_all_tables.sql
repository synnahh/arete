-- ─────────────────────────────────────────────────────────────────────────────
-- VALERIE V2 — ensure EVERY useCollection table exists (cross-device sync + backup)
-- Idempotent: safe to run repeatedly. Creates table + RLS owner policy + realtime
-- for any collection that doesn't already have one (e.g. `essentials`, which was
-- localStorage-only). Run once in the Supabase SQL Editor.
--
-- Shape matches every other VALERIE table:
--   id (uuid pk) · user_id (text) · data (jsonb) · created_at (timestamptz)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- core
    'events','programs','essentials','tasks','notes','focus_sessions','habits','goals',
    'routines','places','style_board','watch_list','mood_logs',
    -- finance
    'transactions','savings_goals','subscriptions','planned_purchases','portfolio_holdings',
    'recurring_transactions',
    -- health
    'water_logs','nutrition_logs','workout_logs','body_metrics','supplements',
    'supplement_logs','sleep_data','stimulant_logs','saved_meals',
    -- mind
    'mind_decisions','mind_failures','mind_wisdom','mind_beliefs','mind_memories',
    -- looksmaxxing
    'lm_metrics','lm_strength','lm_daily','lm_sleep','lm_nutrition','lm_skin','lm_haircuts',
    'lm_products','lm_fragrances','lm_wardrobe','lm_outfits','lm_posture','lm_social',
    'lm_photos','lm_experiments'
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

    -- (Re)create the owner policy idempotently
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_owner', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
    $f$, t || '_owner', t);

    -- Add to realtime publication if not already present
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- already in publication
    END;
  END LOOP;
END $$;
