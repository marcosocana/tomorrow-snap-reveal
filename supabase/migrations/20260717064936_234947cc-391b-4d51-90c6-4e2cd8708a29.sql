
-- 1) Add claim columns
ALTER TABLE public.captains_tables
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_device_hash text;

CREATE INDEX IF NOT EXISTS idx_captains_tables_claim_device_hash
  ON public.captains_tables (claim_device_hash);

-- 2) Backfill claimed_at from earliest access, without overwriting existing values
WITH first_access AS (
  SELECT table_id, MIN(COALESCE(selected_at, created_at)) AS first_ts
  FROM public.captains_table_accesses
  GROUP BY table_id
)
UPDATE public.captains_tables t
SET claimed_at = fa.first_ts
FROM first_access fa
WHERE fa.table_id = t.id
  AND t.claimed_at IS NULL;

-- 3+4) Atomic claim function
CREATE OR REPLACE FUNCTION public.claim_captains_table(
  p_table_id uuid,
  p_captain_name text,
  p_device_id uuid,
  p_user_agent text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_table public.captains_tables%ROWTYPE;
  v_status text;
  v_hash text;
  v_now timestamptz := now();
  v_selected_at timestamptz;
BEGIN
  IF p_table_id IS NULL OR p_device_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENTS';
  END IF;

  v_hash := encode(digest(p_device_id::text, 'sha256'), 'hex');

  -- Lock the table row
  SELECT * INTO v_table
  FROM public.captains_tables
  WHERE id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAPTAINS_TABLE_NOT_FOUND';
  END IF;

  -- Verify event status
  SELECT public.captains_event_status(e.start_time, e.end_time)
    INTO v_status
  FROM public.captains_events e
  WHERE e.id = v_table.event_id;

  IF v_status IS NULL OR v_status NOT IN ('scheduled','active') THEN
    RAISE EXCEPTION 'CAPTAINS_EVENT_NOT_AVAILABLE';
  END IF;

  IF v_table.claimed_at IS NOT NULL AND v_table.claim_device_hash IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'CAPTAINS_TABLE_ALREADY_CLAIMED';
  END IF;

  IF v_table.claimed_at IS NOT NULL AND v_table.claim_device_hash = v_hash THEN
    -- Idempotent re-claim by same device
    SELECT MIN(COALESCE(selected_at, created_at)) INTO v_selected_at
    FROM public.captains_table_accesses
    WHERE table_id = p_table_id;

    RETURN jsonb_build_object(
      'table', to_jsonb(v_table),
      'selected_at', COALESCE(v_selected_at, v_table.claimed_at)
    );
  END IF;

  -- Free table: claim it
  UPDATE public.captains_tables
     SET claimed_at = v_now,
         claim_device_hash = v_hash,
         active_captain_name = COALESCE(NULLIF(trim(p_captain_name), ''), active_captain_name),
         captain_name = COALESCE(captain_name, NULLIF(trim(p_captain_name), '')),
         last_activity_at = v_now,
         updated_at = v_now
   WHERE id = p_table_id
  RETURNING * INTO v_table;

  INSERT INTO public.captains_table_accesses (
    event_id, table_id, table_name, captain_name, selected_at, device_id, user_agent, device_info
  ) VALUES (
    v_table.event_id, v_table.id, v_table.table_name,
    NULLIF(trim(p_captain_name), ''), v_now, v_hash, p_user_agent, p_device_info
  );

  RETURN jsonb_build_object(
    'table', to_jsonb(v_table),
    'selected_at', v_now
  );
END;
$$;

-- Ensure pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 5) Restrict anon direct UPDATE, keep column-level game columns
REVOKE UPDATE ON public.captains_tables FROM anon;
GRANT UPDATE (
  total_points,
  completed_challenges,
  failed_challenges,
  last_activity_at,
  completed_at,
  current_challenge_id,
  updated_at,
  captain_photo_url,
  captain_sprite,
  captain_sprite_config,
  session_token
) ON public.captains_tables TO anon;

-- Preserve authenticated / service_role full access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_tables TO authenticated;
GRANT ALL ON public.captains_tables TO service_role;

-- 6) Execute grants on RPC
REVOKE ALL ON FUNCTION public.claim_captains_table(uuid, text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_captains_table(uuid, text, uuid, text, jsonb) TO anon, authenticated, service_role;

-- 7) Add to realtime publication if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'captains_tables'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.captains_tables';
  END IF;
END $$;

-- 8) Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
