-- A blank last_activity_at means that the table is available again, even if
-- legacy claim metadata remains. Keep the claim itself atomic.
CREATE OR REPLACE FUNCTION public.claim_captains_table(
  p_table_id uuid,
  p_captain_name text,
  p_device_id uuid,
  p_user_agent text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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

  SELECT * INTO v_table
  FROM public.captains_tables
  WHERE id = p_table_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAPTAINS_TABLE_NOT_FOUND';
  END IF;

  SELECT public.captains_event_status(e.start_time, e.end_time)
    INTO v_status
  FROM public.captains_events e
  WHERE e.id = v_table.event_id;

  IF v_status IS NULL OR v_status NOT IN ('scheduled', 'active') THEN
    RAISE EXCEPTION 'CAPTAINS_EVENT_NOT_AVAILABLE';
  END IF;

  IF v_table.last_activity_at IS NOT NULL
     AND v_table.claimed_at IS NOT NULL
     AND v_table.claim_device_hash IS DISTINCT FROM v_hash THEN
    RAISE EXCEPTION 'CAPTAINS_TABLE_ALREADY_CLAIMED';
  END IF;

  IF v_table.last_activity_at IS NOT NULL
     AND v_table.claimed_at IS NOT NULL
     AND v_table.claim_device_hash = v_hash THEN
    SELECT MIN(COALESCE(selected_at, created_at)) INTO v_selected_at
    FROM public.captains_table_accesses
    WHERE table_id = p_table_id;

    RETURN jsonb_build_object(
      'table', to_jsonb(v_table),
      'selected_at', COALESCE(v_selected_at, v_table.claimed_at)
    );
  END IF;

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

-- Transfer a reservation from one table to another in one transaction. If the
-- target has just been claimed, the exception rolls the release back.
CREATE OR REPLACE FUNCTION public.switch_captains_table_claim(
  p_table_id uuid,
  p_captain_name text,
  p_device_id uuid,
  p_previous_table_id uuid,
  p_previous_session_token text,
  p_user_agent text DEFAULT NULL,
  p_device_info jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_previous_event_id uuid;
  v_target_event_id uuid;
  v_result jsonb;
BEGIN
  IF p_previous_table_id IS NULL
     OR p_previous_session_token IS NULL
     OR p_previous_table_id = p_table_id THEN
    RETURN public.claim_captains_table(
      p_table_id, p_captain_name, p_device_id, p_user_agent, p_device_info
    );
  END IF;

  SELECT event_id INTO v_previous_event_id
  FROM public.captains_tables
  WHERE id = p_previous_table_id
    AND session_token = p_previous_session_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CAPTAINS_PREVIOUS_TABLE_SESSION_INVALID';
  END IF;

  SELECT event_id INTO v_target_event_id
  FROM public.captains_tables
  WHERE id = p_table_id;

  IF v_target_event_id IS NULL OR v_target_event_id IS DISTINCT FROM v_previous_event_id THEN
    RAISE EXCEPTION 'CAPTAINS_TABLE_EVENT_MISMATCH';
  END IF;

  UPDATE public.captains_tables
     SET claimed_at = NULL,
         claim_device_hash = NULL,
         last_activity_at = NULL,
         updated_at = now()
   WHERE id = p_previous_table_id;

  v_result := public.claim_captains_table(
    p_table_id, p_captain_name, p_device_id, p_user_agent, p_device_info
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.switch_captains_table_claim(uuid, text, uuid, uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_captains_table_claim(uuid, text, uuid, uuid, text, text, jsonb)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
