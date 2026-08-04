CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.demo_lifecycle_email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  email_type text NOT NULL CHECK (email_type IN ('demo_revealed', 'demo_conversion_24h')),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  due_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demo_lifecycle_email_jobs_due_idx
  ON public.demo_lifecycle_email_jobs (due_at)
  WHERE status = 'pending';

GRANT ALL ON public.demo_lifecycle_email_jobs TO service_role;

ALTER TABLE public.demo_lifecycle_email_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_demo_lifecycle_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL OR NOT (
    NEW.is_demo = true OR NEW.type = 'demo' OR NEW.plan_id = 'demo'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.demo_lifecycle_email_jobs (
    dedupe_key, email_type, event_id, user_id, due_at
  ) VALUES (
    'reveal:' || NEW.id::text,
    'demo_revealed',
    NEW.id,
    NEW.owner_id,
    NEW.reveal_time
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  INSERT INTO public.demo_lifecycle_email_jobs (
    dedupe_key, email_type, event_id, user_id, due_at
  ) VALUES (
    'conversion:' || NEW.owner_id::text,
    'demo_conversion_24h',
    NEW.id,
    NEW.owner_id,
    NEW.created_at + interval '24 hours'
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_demo_lifecycle_emails_after_insert ON public.events;
CREATE TRIGGER enqueue_demo_lifecycle_emails_after_insert
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_demo_lifecycle_emails();

CREATE OR REPLACE FUNCTION public.schedule_demo_lifecycle_email_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions, vault
AS $$
BEGIN
  PERFORM cron.schedule(
    'process-demo-lifecycle-emails',
    '*/5 * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
          || '/functions/v1/process-demo-lifecycle-emails',
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

REVOKE ALL ON FUNCTION public.schedule_demo_lifecycle_email_cron() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'publishable_key') THEN
    PERFORM public.schedule_demo_lifecycle_email_cron();
  END IF;
END;
$$;