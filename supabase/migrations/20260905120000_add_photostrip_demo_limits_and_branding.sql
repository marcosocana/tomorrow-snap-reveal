ALTER TABLE public.photostrip_event_configs
  ADD COLUMN IF NOT EXISTS max_strips integer
  CHECK (max_strips IS NULL OR max_strips > 0);

ALTER TABLE public.photostrip_event_configs
  ALTER COLUMN logo_url SET DEFAULT 'https://acceso.revelao.cam/LogoMiniRevelao.svg';

UPDATE public.photostrip_event_configs
SET logo_url = 'https://acceso.revelao.cam/LogoMiniRevelao.svg'
WHERE logo_path IS NULL
  AND NULLIF(btrim(logo_url), '') IS NULL;

CREATE OR REPLACE FUNCTION public.claim_photostrip_participation(
  target_event_id uuid,
  target_participant_id uuid,
  target_access_token_hash text,
  target_mode text
)
RETURNS public.photostrip_participations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  configured_limit integer;
  reserved_count integer;
  result public.photostrip_participations;
BEGIN
  SELECT max_strips
  INTO configured_limit
  FROM public.photostrip_event_configs
  WHERE event_id = target_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHOTOSTRIP_NOT_FOUND';
  END IF;

  SELECT *
  INTO result
  FROM public.photostrip_participations
  WHERE event_id = target_event_id
    AND participant_id = target_participant_id;

  IF result.id IS NOT NULL THEN
    RETURN result;
  END IF;

  IF configured_limit IS NOT NULL THEN
    SELECT count(*)
    INTO reserved_count
    FROM public.photostrip_participations
    WHERE event_id = target_event_id
      AND deleted_at IS NULL
      AND status <> 'failed';

    IF reserved_count >= configured_limit THEN
      RAISE EXCEPTION 'PHOTOSTRIP_LIMIT_REACHED';
    END IF;
  END IF;

  INSERT INTO public.photostrip_participations (
    event_id, participant_id, access_token_hash, mode, status
  ) VALUES (
    target_event_id, target_participant_id, target_access_token_hash, target_mode, 'started'
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_photostrip_participation(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_photostrip_participation(uuid, uuid, text, text)
  TO service_role;

-- Photostrip is visible immediately, so it must not receive the standard
-- "content revealed" demo email. Keep the 24-hour conversion follow-up only.
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

  IF NEW.type <> 'photostrip' THEN
    INSERT INTO public.demo_lifecycle_email_jobs (
      dedupe_key, email_type, event_id, user_id, due_at
    ) VALUES (
      'reveal:' || NEW.id::text,
      'demo_revealed',
      NEW.id,
      NEW.owner_id,
      NEW.reveal_time
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

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
