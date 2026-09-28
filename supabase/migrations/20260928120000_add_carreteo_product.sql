-- Carreteo: cámara desechable digital. Cada invitado (dispositivo) tiene su
-- propio carrete de N exposiciones; las fotos permanecen ocultas hasta la
-- hora de revelado del evento.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_type_check CHECK (type IN ('demo', 'paid', 'capsule', 'photostrip', 'carreteo'));

CREATE TABLE public.carreteo_event_configs (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  enabled boolean NOT NULL DEFAULT true,
  shots_per_camera smallint NOT NULL DEFAULT 27 CHECK (shots_per_camera BETWEEN 1 AND 99),
  max_cameras integer CHECK (max_cameras IS NULL OR max_cameras > 0),
  gallery_views bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.carreteo_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  access_token_hash text NOT NULL CHECK (char_length(access_token_hash) = 64),
  shots_taken smallint NOT NULL DEFAULT 0 CHECK (shots_taken >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_shot_at timestamptz,
  UNIQUE (event_id, participant_id)
);

CREATE TABLE public.carreteo_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  camera_id uuid NOT NULL REFERENCES public.carreteo_cameras(id) ON DELETE CASCADE,
  frame_number smallint NOT NULL CHECK (frame_number BETWEEN 1 AND 99),
  image_path text,
  thumbnail_path text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (camera_id, frame_number)
);

CREATE INDEX carreteo_cameras_event_idx ON public.carreteo_cameras (event_id);
CREATE INDEX carreteo_photos_gallery_idx
  ON public.carreteo_photos (event_id, created_at DESC, id DESC)
  WHERE is_visible AND deleted_at IS NULL;
CREATE INDEX carreteo_photos_admin_idx ON public.carreteo_photos (event_id, created_at DESC);

ALTER TABLE public.carreteo_event_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carreteo_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carreteo_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Carreteo managers can read configs"
  ON public.carreteo_event_configs FOR SELECT TO authenticated
  USING (public.can_manage_revelao_event(event_id));
CREATE POLICY "Carreteo managers can create configs"
  ON public.carreteo_event_configs FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_revelao_event(event_id));
CREATE POLICY "Carreteo managers can update configs"
  ON public.carreteo_event_configs FOR UPDATE TO authenticated
  USING (public.can_manage_revelao_event(event_id))
  WITH CHECK (public.can_manage_revelao_event(event_id));
CREATE POLICY "Carreteo managers can delete configs"
  ON public.carreteo_event_configs FOR DELETE TO authenticated
  USING (public.can_manage_revelao_event(event_id));

CREATE POLICY "Carreteo managers can read cameras"
  ON public.carreteo_cameras FOR SELECT TO authenticated
  USING (public.can_manage_revelao_event(event_id));
CREATE POLICY "Carreteo managers can read photos"
  ON public.carreteo_photos FOR SELECT TO authenticated
  USING (public.can_manage_revelao_event(event_id));

REVOKE ALL ON public.carreteo_event_configs FROM PUBLIC, anon;
REVOKE ALL ON public.carreteo_cameras FROM PUBLIC, anon;
REVOKE ALL ON public.carreteo_photos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carreteo_event_configs TO authenticated;
GRANT SELECT ON public.carreteo_cameras TO authenticated;
GRANT SELECT ON public.carreteo_photos TO authenticated;
GRANT ALL ON public.carreteo_event_configs, public.carreteo_cameras, public.carreteo_photos TO service_role;

-- Las fotos solo se sirven con URLs firmadas desde carreteo-api.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'carreteo',
  'carreteo',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Carreteo managers can read objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'carreteo'
    AND public.can_manage_revelao_event((storage.foldername(name))[1]::uuid)
  );
CREATE POLICY "Carreteo managers can delete objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'carreteo'
    AND public.can_manage_revelao_event((storage.foldername(name))[1]::uuid)
  );

CREATE OR REPLACE FUNCTION public.set_carreteo_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_carreteo_config_updated_at
  BEFORE UPDATE ON public.carreteo_event_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_carreteo_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'carreteo_photos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carreteo_photos;
  END IF;
END
$$;

-- Devuelve la cámara del dispositivo, creándola si hay hueco en el evento.
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
  configured_limit integer;
  camera_count integer;
  result public.carreteo_cameras;
BEGIN
  SELECT max_cameras
  INTO configured_limit
  FROM public.carreteo_event_configs
  WHERE event_id = target_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARRETEO_NOT_FOUND';
  END IF;

  SELECT *
  INTO result
  FROM public.carreteo_cameras
  WHERE event_id = target_event_id
    AND participant_id = target_participant_id;

  IF result.id IS NOT NULL THEN
    RETURN result;
  END IF;

  IF configured_limit IS NOT NULL THEN
    SELECT count(*) INTO camera_count
    FROM public.carreteo_cameras
    WHERE event_id = target_event_id;

    IF camera_count >= configured_limit THEN
      RAISE EXCEPTION 'CARRETEO_CAMERA_LIMIT_REACHED';
    END IF;
  END IF;

  INSERT INTO public.carreteo_cameras (event_id, participant_id, access_token_hash)
  VALUES (target_event_id, target_participant_id, target_access_token_hash)
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- Consume una exposición del carrete y registra la foto de forma atómica.
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
  camera public.carreteo_cameras;
  result public.carreteo_photos;
BEGIN
  SELECT shots_per_camera INTO shot_limit
  FROM public.carreteo_event_configs
  WHERE event_id = target_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CARRETEO_NOT_FOUND';
  END IF;

  SELECT * INTO camera
  FROM public.carreteo_cameras
  WHERE id = target_camera_id AND event_id = target_event_id
  FOR UPDATE;

  IF camera.id IS NULL THEN
    RAISE EXCEPTION 'CARRETEO_CAMERA_NOT_FOUND';
  END IF;
  IF camera.shots_taken >= shot_limit THEN
    RAISE EXCEPTION 'CARRETEO_ROLL_FINISHED';
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

CREATE OR REPLACE FUNCTION public.increment_carreteo_gallery_views(target_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.carreteo_event_configs
  SET gallery_views = gallery_views + 1
  WHERE event_id = target_event_id;
$$;

CREATE OR REPLACE FUNCTION public.get_carreteo_admin_metrics(target_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cameras', (SELECT count(*) FROM public.carreteo_cameras WHERE event_id = target_event_id),
    'finishedRolls', (
      SELECT count(*) FROM public.carreteo_cameras c
      JOIN public.carreteo_event_configs cfg ON cfg.event_id = c.event_id
      WHERE c.event_id = target_event_id AND c.shots_taken >= cfg.shots_per_camera
    ),
    'photos', (SELECT count(*) FROM public.carreteo_photos WHERE event_id = target_event_id AND deleted_at IS NULL),
    'latest', (SELECT max(created_at) FROM public.carreteo_photos WHERE event_id = target_event_id AND deleted_at IS NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.claim_carreteo_camera(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_carreteo_shot(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_carreteo_gallery_views(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_carreteo_admin_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_carreteo_camera(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_carreteo_shot(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_carreteo_gallery_views(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_carreteo_admin_metrics(uuid) TO service_role;

ALTER TABLE public.purchase_email_outbox
  DROP CONSTRAINT IF EXISTS purchase_email_outbox_email_type_check;
ALTER TABLE public.purchase_email_outbox
  ADD CONSTRAINT purchase_email_outbox_email_type_check
  CHECK (email_type IN ('revelao_purchase', 'captains_purchase', 'photostrip_purchase', 'carreteo_purchase'));
