CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.time_capsule_unlock_credentials (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  unlock_password text NOT NULL,
  password_hash text NOT NULL,
  due_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS time_capsule_unlock_due_idx
  ON public.time_capsule_unlock_credentials (due_at)
  WHERE status = 'pending';

ALTER TABLE public.time_capsule_unlock_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.time_capsule_unlock_credentials FROM anon, authenticated;
GRANT ALL ON public.time_capsule_unlock_credentials TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_time_capsule_unlock_credential()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  generated_password text;
BEGIN
  IF NOT (COALESCE(NEW.plan_id = 'capsule', false) OR COALESCE(NEW.type = 'capsule', false))
    OR NEW.upload_end_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 12))
  INTO generated_password;

  INSERT INTO public.time_capsule_unlock_credentials (
    event_id, unlock_password, password_hash, due_at
  ) VALUES (
    NEW.id,
    generated_password,
    encode(digest(generated_password, 'sha256'), 'hex'),
    NEW.upload_end_time
  )
  ON CONFLICT (event_id) DO UPDATE
    SET due_at = EXCLUDED.due_at,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_time_capsule_unlock_credential_after_write ON public.events;
CREATE TRIGGER ensure_time_capsule_unlock_credential_after_write
  AFTER INSERT OR UPDATE OF upload_end_time, plan_id, type ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_time_capsule_unlock_credential();

INSERT INTO public.time_capsule_unlock_credentials (
  event_id, unlock_password, password_hash, due_at
)
SELECT
  event.id,
  generated.password,
  encode(digest(generated.password, 'sha256'), 'hex'),
  event.upload_end_time
FROM public.events AS event
CROSS JOIN LATERAL (
  SELECT upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 12)) AS password
  WHERE event.id IS NOT NULL
) AS generated
WHERE (event.plan_id = 'capsule' OR event.type = 'capsule')
  AND event.upload_end_time IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

DROP POLICY IF EXISTS "Public read event-videos" ON storage.objects;
DROP POLICY IF EXISTS "Videos accessible after reveal" ON storage.objects;
DROP POLICY IF EXISTS "Revelao videos accessible after reveal" ON storage.objects;
CREATE POLICY "Revelao videos accessible after reveal"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'event-videos'
    AND EXISTS (
      SELECT 1
      FROM public.videos AS video
      JOIN public.events AS event ON event.id = video.event_id
      WHERE video.video_url = storage.objects.name
        AND event.reveal_time <= now()
        AND NOT (COALESCE(event.plan_id = 'capsule', false) OR COALESCE(event.type = 'capsule', false))
    )
  );

DROP POLICY IF EXISTS "Anyone can read videos" ON public.videos;
DROP POLICY IF EXISTS "Videos visible after reveal" ON public.videos;
DROP POLICY IF EXISTS "Revelao videos visible after reveal" ON public.videos;
CREATE POLICY "Revelao videos visible after reveal"
  ON public.videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events AS event
      WHERE event.id = videos.event_id
        AND event.reveal_time <= now()
        AND NOT (COALESCE(event.plan_id = 'capsule', false) OR COALESCE(event.type = 'capsule', false))
    )
  );

CREATE OR REPLACE FUNCTION public.schedule_time_capsule_unlock_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions, vault
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-time-capsule-unlocks') THEN
    PERFORM cron.unschedule('process-time-capsule-unlocks');
  END IF;

  PERFORM cron.schedule(
    'process-time-capsule-unlocks',
    '*/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
          || '/functions/v1/process-time-capsule-unlocks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 15000
      );
    $cron$
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_time_capsule_unlock_cron() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'publishable_key') THEN
    PERFORM public.schedule_time_capsule_unlock_cron();
  END IF;
END;
$$;