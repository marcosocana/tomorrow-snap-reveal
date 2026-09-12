-- Daily reset of the Captains demo event (slug demo-capitanes-v2 / id de100000-0000-4000-8000-000000000001)
-- Runs once per day at 23:59 Europe/Madrid all year round.
CREATE OR REPLACE FUNCTION public.schedule_captains_demo_evidence_purge()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'extensions', 'vault'
AS $function$
BEGIN
  -- Remove any previous job(s) handling the demo cleanup to avoid duplicates.
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN ('purge-captains-demo-evidence', 'reset-captains-demo-daily');

  -- 21:59 UTC (CEST) and 22:59 UTC (CET); the inner guard keeps exactly one run per day.
  PERFORM cron.schedule(
    'reset-captains-demo-daily',
    '59 21,22 * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
          || '/functions/v1/purge-captains-demo-evidence',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 60000
      )
      WHERE to_char(timezone('Europe/Madrid', now()), 'HH24:MI') = '23:59';
    $cron$
  );
END;
$function$;

SELECT public.schedule_captains_demo_evidence_purge();