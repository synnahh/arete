-- ─────────────────────────────────────────────────────────────────────────────
-- VALERIE — reassign ALL existing rows to your single real account.
--
-- WHY: before this change every device signed in anonymously and got its own
-- user_id, so data was scattered across several throwaway ids (and RLS hid it
-- from the other device). This is a single-user database, so we simply move
-- every row onto your one real account id.
--
-- HOW TO USE
--   1. Supabase Dashboard → Authentication → Users → copy your user's UID.
--   2. Paste it into NEW_UID below (keep the quotes).
--   3. Run this in the Supabase SQL Editor.
--
-- Safe to run more than once. Rows already owned by NEW_UID are left alone.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  NEW_UID text := 'PASTE-YOUR-USER-UID-HERE';
  t text;
  moved bigint;
  total bigint := 0;
BEGIN
  IF NEW_UID = 'PASTE-YOUR-USER-UID-HERE' THEN
    RAISE EXCEPTION 'Set NEW_UID to your account UID first (Authentication → Users).';
  END IF;

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
    'lm_photos','lm_experiments',
    -- key/value settings store
    'user_meta'
  ]
  LOOP
    -- skip tables that don't exist in this project
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('UPDATE public.%I SET user_id = %L WHERE user_id <> %L;', t, NEW_UID, NEW_UID);
    GET DIAGNOSTICS moved = ROW_COUNT;
    total := total + moved;
    IF moved > 0 THEN
      RAISE NOTICE '% → moved % row(s)', t, moved;
    END IF;
  END LOOP;

  RAISE NOTICE 'Done. % row(s) reassigned to %', total, NEW_UID;
END $$;
