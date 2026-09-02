CREATE TABLE IF NOT EXISTS public.public_event_configs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,
  reveal_time timestamptz NOT NULL,
  upload_start_time timestamptz,
  upload_end_time timestamptz,
  expiry_date timestamptz,
  expiry_redirect_url text,
  hide_reveal_date boolean NOT NULL DEFAULT false,
  max_photos integer,
  max_videos integer NOT NULL DEFAULT 0,
  max_video_duration integer NOT NULL DEFAULT 0,
  max_audios integer NOT NULL DEFAULT 0,
  max_audio_duration integer NOT NULL DEFAULT 0,
  allow_photo_deletion boolean NOT NULL DEFAULT false,
  allow_photo_sharing boolean NOT NULL DEFAULT false,
  allow_video_recording boolean NOT NULL DEFAULT false,
  allow_audio_recording boolean NOT NULL DEFAULT false,
  allow_image_attachment boolean NOT NULL DEFAULT false,
  allow_video_attachment boolean NOT NULL DEFAULT false,
  like_counting_enabled boolean NOT NULL DEFAULT false,
  show_legal_text boolean NOT NULL DEFAULT false,
  legal_text_type text,
  custom_terms_text text,
  custom_privacy_text text,
  gallery_view_mode text,
  header_style text,
  filter_type text,
  font_family text,
  font_size text,
  custom_image_url text,
  background_image_url text,
  language text,
  timezone text,
  country_code text,
  plan_id text,
  type text,
  is_demo boolean NOT NULL DEFAULT false,
  folder_id uuid,
  limits_json jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_event_configs TO anon;
GRANT SELECT ON public.public_event_configs TO authenticated;
GRANT ALL ON public.public_event_configs TO service_role;

ALTER TABLE public.public_event_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read event configs" ON public.public_event_configs;
CREATE POLICY "Public can read event configs"
  ON public.public_event_configs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.sanitize_public_event_limits(raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL OR jsonb_typeof(raw) <> 'object' THEN raw
    ELSE (raw - 'qr_password_hash')
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_public_event_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.public_event_configs WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  INSERT INTO public.public_event_configs (
    id, name, description, reveal_time, upload_start_time, upload_end_time,
    expiry_date, expiry_redirect_url, hide_reveal_date, max_photos, max_videos,
    max_video_duration, max_audios, max_audio_duration, allow_photo_deletion,
    allow_photo_sharing, allow_video_recording, allow_audio_recording,
    allow_image_attachment, allow_video_attachment, like_counting_enabled,
    show_legal_text, legal_text_type, custom_terms_text, custom_privacy_text,
    gallery_view_mode, header_style, filter_type, font_family, font_size,
    custom_image_url, background_image_url, language, timezone, country_code,
    plan_id, type, is_demo, folder_id, limits_json, updated_at
  ) VALUES (
    NEW.id, NEW.name, NEW.description, NEW.reveal_time, NEW.upload_start_time, NEW.upload_end_time,
    NEW.expiry_date, NEW.expiry_redirect_url, NEW.hide_reveal_date, NEW.max_photos, NEW.max_videos,
    NEW.max_video_duration, NEW.max_audios, NEW.max_audio_duration, NEW.allow_photo_deletion,
    NEW.allow_photo_sharing, NEW.allow_video_recording, NEW.allow_audio_recording,
    NEW.allow_image_attachment, NEW.allow_video_attachment, NEW.like_counting_enabled,
    NEW.show_legal_text, NEW.legal_text_type, NEW.custom_terms_text, NEW.custom_privacy_text,
    NEW.gallery_view_mode, NEW.header_style, NEW.filter_type, NEW.font_family, NEW.font_size,
    NEW.custom_image_url, NEW.background_image_url, NEW.language, NEW.timezone, NEW.country_code,
    NEW.plan_id, NEW.type, NEW.is_demo, NEW.folder_id,
    public.sanitize_public_event_limits(NEW.limits_json), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    reveal_time = EXCLUDED.reveal_time,
    upload_start_time = EXCLUDED.upload_start_time,
    upload_end_time = EXCLUDED.upload_end_time,
    expiry_date = EXCLUDED.expiry_date,
    expiry_redirect_url = EXCLUDED.expiry_redirect_url,
    hide_reveal_date = EXCLUDED.hide_reveal_date,
    max_photos = EXCLUDED.max_photos,
    max_videos = EXCLUDED.max_videos,
    max_video_duration = EXCLUDED.max_video_duration,
    max_audios = EXCLUDED.max_audios,
    max_audio_duration = EXCLUDED.max_audio_duration,
    allow_photo_deletion = EXCLUDED.allow_photo_deletion,
    allow_photo_sharing = EXCLUDED.allow_photo_sharing,
    allow_video_recording = EXCLUDED.allow_video_recording,
    allow_audio_recording = EXCLUDED.allow_audio_recording,
    allow_image_attachment = EXCLUDED.allow_image_attachment,
    allow_video_attachment = EXCLUDED.allow_video_attachment,
    like_counting_enabled = EXCLUDED.like_counting_enabled,
    show_legal_text = EXCLUDED.show_legal_text,
    legal_text_type = EXCLUDED.legal_text_type,
    custom_terms_text = EXCLUDED.custom_terms_text,
    custom_privacy_text = EXCLUDED.custom_privacy_text,
    gallery_view_mode = EXCLUDED.gallery_view_mode,
    header_style = EXCLUDED.header_style,
    filter_type = EXCLUDED.filter_type,
    font_family = EXCLUDED.font_family,
    font_size = EXCLUDED.font_size,
    custom_image_url = EXCLUDED.custom_image_url,
    background_image_url = EXCLUDED.background_image_url,
    language = EXCLUDED.language,
    timezone = EXCLUDED.timezone,
    country_code = EXCLUDED.country_code,
    plan_id = EXCLUDED.plan_id,
    type = EXCLUDED.type,
    is_demo = EXCLUDED.is_demo,
    folder_id = EXCLUDED.folder_id,
    limits_json = EXCLUDED.limits_json,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_public_event_config_after_write ON public.events;
CREATE TRIGGER sync_public_event_config_after_write
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.sync_public_event_config();

INSERT INTO public.public_event_configs (
  id, name, description, reveal_time, upload_start_time, upload_end_time,
  expiry_date, expiry_redirect_url, hide_reveal_date, max_photos, max_videos,
  max_video_duration, max_audios, max_audio_duration, allow_photo_deletion,
  allow_photo_sharing, allow_video_recording, allow_audio_recording,
  allow_image_attachment, allow_video_attachment, like_counting_enabled,
  show_legal_text, legal_text_type, custom_terms_text, custom_privacy_text,
  gallery_view_mode, header_style, filter_type, font_family, font_size,
  custom_image_url, background_image_url, language, timezone, country_code,
  plan_id, type, is_demo, folder_id, limits_json, updated_at
)
SELECT
  e.id, e.name, e.description, e.reveal_time, e.upload_start_time, e.upload_end_time,
  e.expiry_date, e.expiry_redirect_url, e.hide_reveal_date, e.max_photos, e.max_videos,
  e.max_video_duration, e.max_audios, e.max_audio_duration, e.allow_photo_deletion,
  e.allow_photo_sharing, e.allow_video_recording, e.allow_audio_recording,
  e.allow_image_attachment, e.allow_video_attachment, e.like_counting_enabled,
  e.show_legal_text, e.legal_text_type, e.custom_terms_text, e.custom_privacy_text,
  e.gallery_view_mode, e.header_style, e.filter_type, e.font_family, e.font_size,
  e.custom_image_url, e.background_image_url, e.language, e.timezone, e.country_code,
  e.plan_id, e.type, e.is_demo, e.folder_id,
  public.sanitize_public_event_limits(e.limits_json), now()
FROM public.events e
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_event_qr_password(
  target_event_id uuid,
  candidate_password text,
  target text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  limits jsonb;
  expected_hash text;
  scope jsonb;
  scope_required boolean;
BEGIN
  SELECT e.limits_json INTO limits FROM public.events e WHERE e.id = target_event_id;
  IF limits IS NULL OR jsonb_typeof(limits) <> 'object' THEN
    RETURN true;
  END IF;

  expected_hash := NULLIF(limits ->> 'qr_password_hash', '');
  IF (limits ->> 'qr_password_enabled') IS DISTINCT FROM 'true' OR expected_hash IS NULL THEN
    RETURN true;
  END IF;

  scope := limits -> 'qr_password_scope';
  IF scope IS NULL OR jsonb_typeof(scope) <> 'object' THEN
    scope_required := true;
  ELSE
    scope_required := COALESCE((scope ->> target)::boolean, false);
  END IF;

  IF NOT scope_required THEN
    RETURN true;
  END IF;

  RETURN encode(digest(COALESCE(candidate_password, ''), 'sha256'), 'hex') = expected_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_event_qr_password(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_event_qr_password(uuid, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_public_event_access(access_password text)
RETURNS TABLE(event_id uuid, access_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, 'admin'::text
  FROM public.events e
  WHERE e.admin_password IS NOT NULL
    AND e.admin_password = access_password
  UNION ALL
  SELECT e.id, 'guest'::text
  FROM public.events e
  WHERE e.password_hash = access_password
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_event_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_event_access(text) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'public_event_configs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.public_event_configs';
  END IF;
END $$;

ALTER TABLE public.public_event_configs REPLICA IDENTITY FULL;