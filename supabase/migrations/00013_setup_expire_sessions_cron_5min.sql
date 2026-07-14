
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing schedule for this job
SELECT cron.unschedule('expire-sessions-cron') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-sessions-cron'
);

-- Schedule expire-sessions every 5 minutes
SELECT cron.schedule(
  'expire-sessions-cron',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT current_setting('app.supabase_url', true) || '/functions/v1/expire-sessions'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body   := '{}'::jsonb
  );
  $$
);
