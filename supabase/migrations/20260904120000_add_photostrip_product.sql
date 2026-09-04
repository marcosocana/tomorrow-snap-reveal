CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_type_check CHECK (type IN ('demo', 'paid', 'capsule', 'photostrip'));

CREATE TABLE public.photostrip_event_configs (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  enabled boolean NOT NULL DEFAULT true,
  photo_count smallint NOT NULL DEFAULT 4 CHECK (photo_count BETWEEN 1 AND 8),
  countdown_seconds smallint NOT NULL DEFAULT 3 CHECK (countdown_seconds BETWEEN 1 AND 10),
  photo_mode text NOT NULL DEFAULT 'both' CHECK (photo_mode IN ('color', 'bw', 'both')),
  gallery_visibility text NOT NULL DEFAULT 'participants' CHECK (gallery_visibility IN ('public', 'participants', 'admin_only')),
  strip_template text NOT NULL DEFAULT 'classic' CHECK (strip_template IN ('classic')),
  strip_display_name text,
  strip_footer_text text CHECK (char_length(strip_footer_text) <= 120),
  logo_path text,
  logo_url text,
  gallery_views bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.photostrip_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL,
  access_token_hash text NOT NULL CHECK (char_length(access_token_hash) = 64),
  mode text NOT NULL CHECK (mode IN ('color', 'bw')),
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'capturing', 'processing', 'completed', 'failed')),
  strip_path text,
  thumbnail_path text,
  is_visible boolean NOT NULL DEFAULT true,
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (event_id, participant_id)
);

CREATE TABLE public.photostrip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id uuid NOT NULL REFERENCES public.photostrip_participations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 8),
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participation_id, position)
);

CREATE INDEX photostrip_participations_gallery_idx
  ON public.photostrip_participations (event_id, completed_at DESC, id DESC)
  WHERE status = 'completed' AND is_visible AND deleted_at IS NULL;
CREATE INDEX photostrip_participations_admin_idx
  ON public.photostrip_participations (event_id, created_at DESC);
CREATE INDEX photostrip_photos_event_idx ON public.photostrip_photos (event_id, participation_id);

ALTER TABLE public.photostrip_event_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photostrip_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photostrip_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photostrip managers can read configs"
  ON public.photostrip_event_configs FOR SELECT TO authenticated
  USING (public.can_manage_revelao_event(event_id));
CREATE POLICY "Photostrip managers can create configs"
  ON public.photostrip_event_configs FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_revelao_event(event_id));
CREATE POLICY "Photostrip managers can update configs"
  ON public.photostrip_event_configs FOR UPDATE TO authenticated
  USING (public.can_manage_revelao_event(event_id))
  WITH CHECK (public.can_manage_revelao_event(event_id));
CREATE POLICY "Photostrip managers can delete configs"
  ON public.photostrip_event_configs FOR DELETE TO authenticated
  USING (public.can_manage_revelao_event(event_id));

CREATE POLICY "Photostrip managers can read participations"
  ON public.photostrip_participations FOR SELECT TO authenticated
  USING (public.can_manage_revelao_event(event_id));
CREATE POLICY "Photostrip managers can update participations"
  ON public.photostrip_participations FOR UPDATE TO authenticated
  USING (public.can_manage_revelao_event(event_id))
  WITH CHECK (public.can_manage_revelao_event(event_id));
CREATE POLICY "Photostrip managers can read photos"
  ON public.photostrip_photos FOR SELECT TO authenticated
  USING (public.can_manage_revelao_event(event_id));

REVOKE ALL ON public.photostrip_event_configs FROM PUBLIC, anon;
REVOKE ALL ON public.photostrip_participations FROM PUBLIC, anon;
REVOKE ALL ON public.photostrip_photos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photostrip_event_configs TO authenticated;
GRANT SELECT, UPDATE ON public.photostrip_participations TO authenticated;
GRANT SELECT ON public.photostrip_photos TO authenticated;
GRANT ALL ON public.photostrip_event_configs, public.photostrip_participations, public.photostrip_photos TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photostrips',
  'photostrips',
  false,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Photostrip managers can read objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'photostrips'
    AND public.can_manage_revelao_event((storage.foldername(name))[1]::uuid)
  );
CREATE POLICY "Photostrip managers can upload branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photostrips'
    AND (storage.foldername(name))[2] = 'branding'
    AND public.can_manage_revelao_event((storage.foldername(name))[1]::uuid)
  );
CREATE POLICY "Photostrip managers can update branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'photostrips'
    AND (storage.foldername(name))[2] = 'branding'
    AND public.can_manage_revelao_event((storage.foldername(name))[1]::uuid)
  );
CREATE POLICY "Photostrip managers can delete objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'photostrips'
    AND public.can_manage_revelao_event((storage.foldername(name))[1]::uuid)
  );

CREATE OR REPLACE FUNCTION public.set_photostrip_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_photostrip_config_updated_at
  BEFORE UPDATE ON public.photostrip_event_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_photostrip_updated_at();
CREATE TRIGGER set_photostrip_participation_updated_at
  BEFORE UPDATE ON public.photostrip_participations
  FOR EACH ROW EXECUTE FUNCTION public.set_photostrip_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'photostrip_participations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photostrip_participations;
  END IF;
END
$$;

ALTER TABLE public.photostrip_participations REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.complete_photostrip_participation(
  target_participation_id uuid,
  target_event_id uuid,
  target_strip_path text,
  target_thumbnail_path text,
  target_photo_paths text[]
)
RETURNS public.photostrip_participations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.photostrip_participations;
  photo_path text;
  photo_position integer := 0;
BEGIN
  IF cardinality(target_photo_paths) <> 4 THEN
    RAISE EXCEPTION 'Exactly four photos are required';
  END IF;

  SELECT * INTO result
  FROM public.photostrip_participations
  WHERE id = target_participation_id
    AND event_id = target_event_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Participation not found';
  END IF;
  IF result.status = 'completed' THEN
    RETURN result;
  END IF;

  DELETE FROM public.photostrip_photos WHERE participation_id = target_participation_id;
  FOREACH photo_path IN ARRAY target_photo_paths LOOP
    photo_position := photo_position + 1;
    INSERT INTO public.photostrip_photos (participation_id, event_id, position, image_path)
    VALUES (target_participation_id, target_event_id, photo_position, photo_path);
  END LOOP;

  UPDATE public.photostrip_participations
  SET status = 'completed',
      strip_path = target_strip_path,
      thumbnail_path = target_thumbnail_path,
      completed_at = now(),
      updated_at = now()
  WHERE id = target_participation_id
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_photostrip_participation(uuid, uuid, text, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_photostrip_participation(uuid, uuid, text, text, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.increment_photostrip_gallery_views(target_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.photostrip_event_configs
  SET gallery_views = gallery_views + 1
  WHERE event_id = target_event_id;
$$;

REVOKE ALL ON FUNCTION public.increment_photostrip_gallery_views(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_photostrip_gallery_views(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_photostrip_admin_metrics(target_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'participations', count(*) FILTER (WHERE deleted_at IS NULL),
    'completed', count(*) FILTER (WHERE status = 'completed' AND deleted_at IS NULL),
    'incomplete', count(*) FILTER (WHERE status <> 'completed' AND deleted_at IS NULL),
    'downloads', coalesce(sum(download_count) FILTER (WHERE deleted_at IS NULL), 0),
    'latest', max(created_at) FILTER (WHERE deleted_at IS NULL)
  )
  FROM public.photostrip_participations
  WHERE event_id = target_event_id;
$$;

REVOKE ALL ON FUNCTION public.get_photostrip_admin_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_photostrip_admin_metrics(uuid) TO service_role;
