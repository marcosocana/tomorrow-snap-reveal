-- Demo evidence is physically removed after one hour. The Edge Function uses
-- the Storage API so both object metadata and the underlying file are deleted.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.list_expired_captains_demo_storage_objects(
  cutoff timestamptz,
  batch_limit integer DEFAULT 500
)
RETURNS TABLE(name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
  SELECT object.name
  FROM storage.objects object
  JOIN public.captains_events event
    ON event.id::text = split_part(object.name, '/', 1)
  WHERE object.bucket_id = 'captains-evidence'
    AND event.slug = 'demo-capitanes-v2'
    AND object.created_at < cutoff
  ORDER BY object.created_at, object.name
  LIMIT LEAST(GREATEST(batch_limit, 1), 500);
$$;

REVOKE ALL ON FUNCTION public.list_expired_captains_demo_storage_objects(timestamptz, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_captains_demo_storage_objects(timestamptz, integer)
TO service_role;

DROP POLICY IF EXISTS "Public can read evidence of visible events" ON public.captains_evidence;
CREATE POLICY "Public can read evidence of visible events"
  ON public.captains_evidence
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      WHERE event.id = captains_evidence.event_id
        AND public.captains_event_status(event.start_time, event.end_time)
          IN ('scheduled', 'active', 'finished')
        AND (
          event.slug <> 'demo-capitanes-v2'
          OR captains_evidence.created_at >= now() - interval '1 hour'
        )
    )
  );

CREATE OR REPLACE FUNCTION public.schedule_captains_demo_evidence_purge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions, vault
AS $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'purge-captains-demo-evidence';

  PERFORM cron.schedule(
    'purge-captains-demo-evidence',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
          || '/functions/v1/purge-captains-demo-evidence',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 30000
      );
    $cron$
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_captains_demo_evidence_purge()
FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'publishable_key') THEN
    PERFORM public.schedule_captains_demo_evidence_purge();
  END IF;
END;
$$;
