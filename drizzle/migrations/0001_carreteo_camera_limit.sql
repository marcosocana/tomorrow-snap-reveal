CREATE OR REPLACE FUNCTION public.claim_carreteo_camera(
  target_event_id uuid,
  target_participant_id uuid,
  target_access_token_hash text
)
RETURNS public.carreteo_cameras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.carreteo_cameras;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.carreteo_event_configs WHERE event_id = target_event_id) THEN
    RAISE EXCEPTION 'CARRETEO_NOT_FOUND';
  END IF;

  SELECT * INTO result
  FROM public.carreteo_cameras
  WHERE event_id = target_event_id
    AND participant_id = target_participant_id;

  IF result.id IS NOT NULL THEN
    RETURN result;
  END IF;

  INSERT INTO public.carreteo_cameras (event_id, participant_id, access_token_hash)
  VALUES (target_event_id, target_participant_id, target_access_token_hash)
  ON CONFLICT (event_id, participant_id) DO NOTHING;

  SELECT * INTO result
  FROM public.carreteo_cameras
  WHERE event_id = target_event_id
    AND participant_id = target_participant_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_carreteo_shot(
  target_camera_id uuid,
  target_event_id uuid,
  target_image_path text,
  target_thumbnail_path text
)
RETURNS public.carreteo_photos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shot_limit integer;
  camera_limit integer;
  active_cameras integer;
  camera public.carreteo_cameras;
  result public.carreteo_photos;
BEGIN
  SELECT * INTO camera
  FROM public.carreteo_cameras
  WHERE id = target_camera_id AND event_id = target_event_id;

  IF camera.id IS NULL THEN
    RAISE EXCEPTION 'CARRETEO_CAMERA_NOT_FOUND';
  END IF;

  IF camera.shots_taken = 0 THEN
    SELECT shots_per_camera, max_cameras INTO shot_limit, camera_limit
    FROM public.carreteo_event_configs
    WHERE event_id = target_event_id
    FOR UPDATE;
  ELSE
    SELECT shots_per_camera, max_cameras INTO shot_limit, camera_limit
    FROM public.carreteo_event_configs
    WHERE event_id = target_event_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARRETEO_NOT_FOUND';
  END IF;

  SELECT * INTO camera
  FROM public.carreteo_cameras
  WHERE id = target_camera_id
  FOR UPDATE;

  IF camera.shots_taken >= shot_limit THEN
    RAISE EXCEPTION 'CARRETEO_ROLL_FINISHED';
  END IF;

  IF camera.shots_taken = 0 AND camera_limit IS NOT NULL THEN
    SELECT count(*) INTO active_cameras
    FROM public.carreteo_cameras
    WHERE event_id = target_event_id
      AND shots_taken > 0;

    IF active_cameras >= camera_limit THEN
      RAISE EXCEPTION 'CARRETEO_CAMERA_LIMIT_REACHED';
    END IF;
  END IF;

  UPDATE public.carreteo_cameras
  SET shots_taken = shots_taken + 1,
      last_shot_at = now()
  WHERE id = camera.id;

  INSERT INTO public.carreteo_photos (event_id, camera_id, frame_number, image_path, thumbnail_path)
  VALUES (target_event_id, camera.id, camera.shots_taken + 1, target_image_path, target_thumbnail_path)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_carreteo_admin_metrics(target_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cameras', (SELECT count(*) FROM public.carreteo_cameras WHERE event_id = target_event_id AND shots_taken > 0),
    'finishedRolls', (
      SELECT count(*) FROM public.carreteo_cameras c
      JOIN public.carreteo_event_configs cfg ON cfg.event_id = c.event_id
      WHERE c.event_id = target_event_id AND c.shots_taken >= cfg.shots_per_camera
    ),
    'photos', (SELECT count(*) FROM public.carreteo_photos WHERE event_id = target_event_id AND deleted_at IS NULL),
    'latest', (SELECT max(created_at) FROM public.carreteo_photos WHERE event_id = target_event_id AND deleted_at IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_carreteo_plan_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.max_cameras IS DISTINCT FROM OLD.max_cameras OR NEW.shots_per_camera IS DISTINCT FROM OLD.shots_per_camera)
    AND coalesce(auth.role(), 'service_role') <> 'service_role'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) <> 'revelao.cam@gmail.com'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = NEW.event_id AND e.plan_id LIKE 'carreteo\_%'
    )
  THEN
    RAISE EXCEPTION 'CARRETEO_PLAN_LIMITS_LOCKED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_carreteo_plan_limits ON public.carreteo_event_configs;
CREATE TRIGGER protect_carreteo_plan_limits
  BEFORE UPDATE ON public.carreteo_event_configs
  FOR EACH ROW EXECUTE FUNCTION public.protect_carreteo_plan_limits();

REVOKE ALL ON FUNCTION public.protect_carreteo_plan_limits() FROM PUBLIC, anon, authenticated;