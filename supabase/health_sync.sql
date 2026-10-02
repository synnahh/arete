-- ─────────────────────────────────────────────────────────────────────────────
-- Arete — health_sync: one row per day of Apple Health summary numbers (steps,
-- heart rate, HRV, active energy ...), written by the `health-ingest` edge
-- function and read by useAppleHealth. Weigh-ins and sleep go to body_metrics
-- and sleep_data instead, so they show up in the existing screens.
--
-- ADDITIVE AND IDEMPOTENT: safe to run repeatedly in the SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.health_sync (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  sync_date  DATE NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- An older health_sync (from the Firebase-era setup) may exist with another shape.
ALTER TABLE public.health_sync ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.health_sync ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE public.health_sync ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS health_sync_user_day_uidx ON public.health_sync (user_id, sync_date);

ALTER TABLE public.health_sync ENABLE ROW LEVEL SECURITY;

-- The app only reads. The edge function writes with the service role, which bypasses RLS.
DROP POLICY IF EXISTS health_sync_owner_read ON public.health_sync;
CREATE POLICY health_sync_owner_read ON public.health_sync
  FOR SELECT
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.health_sync;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
