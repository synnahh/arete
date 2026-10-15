-- ─────────────────────────────────────────────────────────────────────────────
-- Arete — scheduled push notifications. Run in the Supabase SQL Editor AFTER:
--   1. the push-send function is deployed, and
--   2. its secrets are set (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_CRON_TOKEN, OWNER_USER_ID).
-- See docs/push-setup.md for the whole walk-through.
--
-- No new tables: subscriptions, your reminder times and "already sent today" live in user_meta.
-- This only turns on two extensions and adds a job that wakes the function every 5 minutes.
--
-- BEFORE RUNNING: replace the two placeholders below
--   <ANON_KEY>        Dashboard > Project Settings > API > anon public key (it is public)
--   <PUSH_CRON_TOKEN> the same value you set as the PUSH_CRON_TOKEN secret
-- Keep your edited copy out of git. Safe to run twice: it replaces the job by name.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('arete-push');
EXCEPTION WHEN OTHERS THEN
  NULL; -- not scheduled yet
END $$;

SELECT cron.schedule(
  'arete-push',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url     := 'https://jwzgxcqapxaomuenleyt.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-cron-token',  '<PUSH_CRON_TOKEN>'
    ),
    body    := '{}'::jsonb
  );
  $job$
);

-- Check it is scheduled:   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'arete-push';
-- See recent runs:         SELECT status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
-- Stop it:                 SELECT cron.unschedule('arete-push');
