-- Keep the existing five-minute schedules and 15-minute stale-job recovery,
-- but recover and atomically claim each batch in one database round trip.

-- The pending due_at indexes already match the due-job scans exactly. These
-- complementary partial indexes make the normally-empty stale scans cheap.
CREATE INDEX IF NOT EXISTS demo_lifecycle_email_jobs_processing_updated_idx
  ON public.demo_lifecycle_email_jobs (updated_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS time_capsule_unlock_processing_updated_idx
  ON public.time_capsule_unlock_credentials (updated_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.claim_demo_lifecycle_email_jobs(
  worker_now timestamp with time zone,
  stale_before timestamp with time zone,
  batch_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  dedupe_key text,
  email_type text,
  event_id uuid,
  user_id uuid,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  safe_batch_limit integer := LEAST(GREATEST(COALESCE(batch_limit, 50), 1), 50);
BEGIN
  UPDATE public.demo_lifecycle_email_jobs AS stale_job
  SET status = 'pending',
      last_error = 'Recovered stale processing job',
      updated_at = worker_now
  WHERE stale_job.status = 'processing'
    AND stale_job.updated_at < stale_before;

  RETURN QUERY
  WITH due_jobs AS (
    SELECT pending_job.id
    FROM public.demo_lifecycle_email_jobs AS pending_job
    WHERE pending_job.status = 'pending'
      AND pending_job.due_at <= worker_now
    ORDER BY pending_job.due_at ASC
    LIMIT safe_batch_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed_jobs AS (
    UPDATE public.demo_lifecycle_email_jobs AS claimed_job
    SET status = 'processing',
        attempts = claimed_job.attempts + 1,
        updated_at = worker_now
    FROM due_jobs
    WHERE claimed_job.id = due_jobs.id
    RETURNING
      claimed_job.id,
      claimed_job.dedupe_key,
      claimed_job.email_type,
      claimed_job.event_id,
      claimed_job.user_id,
      claimed_job.attempts,
      claimed_job.due_at
  )
  SELECT
    claimed_jobs.id,
    claimed_jobs.dedupe_key,
    claimed_jobs.email_type,
    claimed_jobs.event_id,
    claimed_jobs.user_id,
    claimed_jobs.attempts
  FROM claimed_jobs
  ORDER BY claimed_jobs.due_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_time_capsule_unlock_jobs(
  worker_now timestamp with time zone,
  stale_before timestamp with time zone,
  batch_limit integer DEFAULT 50
)
RETURNS TABLE (
  event_id uuid,
  unlock_password text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  safe_batch_limit integer := LEAST(GREATEST(COALESCE(batch_limit, 50), 1), 50);
BEGIN
  UPDATE public.time_capsule_unlock_credentials AS stale_job
  SET status = 'pending',
      last_error = 'Recovered stale processing job',
      updated_at = worker_now
  WHERE stale_job.status = 'processing'
    AND stale_job.updated_at < stale_before;

  RETURN QUERY
  WITH due_jobs AS (
    SELECT pending_job.event_id
    FROM public.time_capsule_unlock_credentials AS pending_job
    WHERE pending_job.status = 'pending'
      AND pending_job.due_at <= worker_now
    ORDER BY pending_job.due_at ASC
    LIMIT safe_batch_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed_jobs AS (
    UPDATE public.time_capsule_unlock_credentials AS claimed_job
    SET status = 'processing',
        attempts = claimed_job.attempts + 1,
        updated_at = worker_now
    FROM due_jobs
    WHERE claimed_job.event_id = due_jobs.event_id
    RETURNING
      claimed_job.event_id,
      claimed_job.unlock_password,
      claimed_job.attempts,
      claimed_job.due_at
  )
  SELECT
    claimed_jobs.event_id,
    claimed_jobs.unlock_password,
    claimed_jobs.attempts
  FROM claimed_jobs
  ORDER BY claimed_jobs.due_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_demo_lifecycle_email_jobs(timestamp with time zone, timestamp with time zone, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_demo_lifecycle_email_jobs(timestamp with time zone, timestamp with time zone, integer)
  TO service_role;

REVOKE ALL ON FUNCTION public.claim_time_capsule_unlock_jobs(timestamp with time zone, timestamp with time zone, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_time_capsule_unlock_jobs(timestamp with time zone, timestamp with time zone, integer)
  TO service_role;
