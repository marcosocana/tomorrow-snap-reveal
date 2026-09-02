CREATE OR REPLACE FUNCTION public.verify_event_qr_password(target_event_id uuid, target_scope text, candidate_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  limits jsonb;
  expected_hash text;
  scope jsonb;
  scope_required boolean;
  found_event boolean := false;
BEGIN
  IF target_event_id IS NULL OR target_scope NOT IN ('camera', 'gallery') THEN
    RETURN false;
  END IF;

  SELECT true, e.limits_json
  INTO found_event, limits
  FROM public.events e
  WHERE e.id = target_event_id;

  IF NOT COALESCE(found_event, false) THEN
    RETURN false;
  END IF;

  IF limits IS NULL OR jsonb_typeof(limits) <> 'object' THEN
    RETURN false;
  END IF;

  expected_hash := NULLIF(limits ->> 'qr_password_hash', '');
  IF (limits ->> 'qr_password_enabled') IS DISTINCT FROM 'true' OR expected_hash IS NULL THEN
    RETURN false;
  END IF;

  scope := limits -> 'qr_password_scope';
  IF scope IS NULL OR jsonb_typeof(scope) <> 'object' THEN
    scope_required := true;
  ELSE
    scope_required := COALESCE((scope ->> target_scope)::boolean, false);
  END IF;

  IF NOT scope_required THEN
    RETURN false;
  END IF;

  RETURN encode(digest(COALESCE(candidate_password, ''), 'sha256'), 'hex') = expected_hash;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.verify_event_qr_password(uuid, text, text) TO anon, authenticated, service_role;