-- lovable-cron-fallback-reviewed: 1440 runs/day; durable purchase-email outbox needs sub-minute delivery plus bounded retries after Resend failures; enqueue-time send alone would lose retries.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  stripe_session_id text,
  status text NOT NULL CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  stripe_session_id text NOT NULL,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('revelao_purchase', 'captains_purchase')),
  recipient text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stripe_session_id, email_type)
);

CREATE INDEX IF NOT EXISTS purchase_email_outbox_pending_idx
  ON public.purchase_email_outbox (next_attempt_at, created_at)
  WHERE status = 'pending';

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_email_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stripe_webhook_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.purchase_email_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
GRANT ALL ON public.purchase_email_outbox TO service_role;

CREATE OR REPLACE FUNCTION public.claim_purchase_email_jobs(
  worker_now timestamptz,
  stale_before timestamptz,
  batch_limit integer DEFAULT 25
)
RETURNS SETOF public.purchase_email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.purchase_email_outbox
  SET status = 'pending', updated_at = worker_now
  WHERE status = 'processing'
    AND updated_at < stale_before
    AND attempts < 6;

  RETURN QUERY
  WITH candidates AS (
    SELECT job.id
    FROM public.purchase_email_outbox AS job
    WHERE job.status = 'pending'
      AND job.next_attempt_at <= worker_now
      AND job.attempts < 6
    ORDER BY job.next_attempt_at, job.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(batch_limit, 100))
  )
  UPDATE public.purchase_email_outbox AS job
  SET status = 'processing',
      attempts = job.attempts + 1,
      updated_at = worker_now
  FROM candidates
  WHERE job.id = candidates.id
  RETURNING job.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_purchase_email_jobs(timestamptz, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_purchase_email_jobs(timestamptz, timestamptz, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.schedule_purchase_email_outbox_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions, vault
AS $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'process-purchase-email-outbox';

  PERFORM cron.schedule(
    'process-purchase-email-outbox',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
          || '/functions/v1/process-purchase-email-outbox',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 20000
      );
    $cron$
  );
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_purchase_email_outbox_cron() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'publishable_key') THEN
    PERFORM public.schedule_purchase_email_outbox_cron();
  END IF;
END;
$$;