DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_event_configs'
      AND column_name = 'id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_event_configs'
      AND column_name = 'event_id'
  ) THEN
    ALTER TABLE public.public_event_configs RENAME COLUMN id TO event_id;
  END IF;
END
$$;

ALTER TABLE public.public_event_configs
  ADD COLUMN IF NOT EXISTS qr_password_required_camera boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qr_password_required_gallery boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) AS key(attnum) ON true
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = key.attnum
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'public_event_configs'
      AND con.contype = 'f'
      AND att.attname = 'event_id'
  ) THEN
    ALTER TABLE public.public_event_configs
      ADD CONSTRAINT public_event_configs_event_id_fkey
      FOREIGN KEY (event_id)
      REFERENCES public.events(id)
      ON DELETE CASCADE;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sanitize_public_event_limits(raw jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL OR jsonb_typeof(raw) <> 'object' THEN raw
    ELSE raw - 'qr_password_hash' - 'deletion_lock_pin'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_public_event_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sanitized_limits jsonb;
  qr_enabled boolean;
  qr_hash_exists boolean;
  camera_required boolean;
  gallery_required boolean;
BEGIN
  sanitized_limits := public.sanitize_public_event_limits(NEW.limits_json);
  qr_enabled := COALESCE(NEW.limits_json ->> 'qr_password_enabled', 'false') = 'true';
  qr_hash_exists := NULLIF(NEW.limits_json ->> 'qr_password_hash', '') IS NOT NULL;

  camera_required := qr_enabled
    AND qr_hash_exists
    AND CASE
      WHEN jsonb_typeof(NEW.limits_json -> 'qr_password_scope') = 'object'
        THEN COALESCE(NEW.limits_json #>> '{qr_password_scope,camera}', 'false') = 'true'
      ELSE true
    END;

  gallery_required := qr_enabled
    AND qr_hash_exists
    AND CASE
      WHEN jsonb_typeof(NEW.limits_json -> 'qr_password_scope') = 'object'
        THEN COALESCE(NEW.limits_json #>> '{qr_password_scope,gallery}', 'false') = 'true'
      ELSE true
    END;

  INSERT INTO public.public_event_configs (
    event_id, name, description, reveal_time, upload_start_time, upload_end_time,
    expiry_date, expiry_redirect_url, hide_reveal_date, max_photos, max_videos,
    max_video_duration, max_audios, max_audio_duration, allow_photo_deletion,
    allow_photo_sharing, allow_video_recording, allow_audio_recording,
    allow_image_attachment, allow_video_attachment, like_counting_enabled,
    show_legal_text, legal_text_type, custom_terms_text, custom_privacy_text,
    gallery_view_mode, header_style, filter_type, font_family, font_size,
    custom_image_url, background_image_url, language, timezone, country_code,
    plan_id, type, is_demo, folder_id, limits_json,
    qr_password_required_camera, qr_password_required_gallery, updated_at
  ) VALUES (
    NEW.id, NEW.name, NEW.description, NEW.reveal_time, NEW.upload_start_time, NEW.upload_end_time,
    NEW.expiry_date, NEW.expiry_redirect_url, NEW.hide_reveal_date, NEW.max_photos, NEW.max_videos,
    NEW.max_video_duration, NEW.max_audios, NEW.max_audio_duration, NEW.allow_photo_deletion,
    NEW.allow_photo_sharing, NEW.allow_video_recording, NEW.allow_audio_recording,
    NEW.allow_image_attachment, NEW.allow_video_attachment, NEW.like_counting_enabled,
    NEW.show_legal_text, NEW.legal_text_type, NEW.custom_terms_text, NEW.custom_privacy_text,
    NEW.gallery_view_mode, NEW.header_style, NEW.filter_type, NEW.font_family, NEW.font_size,
    NEW.custom_image_url, NEW.background_image_url, NEW.language, NEW.timezone, NEW.country_code,
    NEW.plan_id, NEW.type, NEW.is_demo, NEW.folder_id, sanitized_limits,
    camera_required, gallery_required, now()
  )
  ON CONFLICT (event_id) DO UPDATE SET
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
    qr_password_required_camera = EXCLUDED.qr_password_required_camera,
    qr_password_required_gallery = EXCLUDED.qr_password_required_gallery,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_public_event_config_after_write ON public.events;
CREATE TRIGGER sync_public_event_config_after_write
AFTER INSERT OR UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_public_event_config();

INSERT INTO public.public_event_configs (
  event_id, name, description, reveal_time, upload_start_time, upload_end_time,
  expiry_date, expiry_redirect_url, hide_reveal_date, max_photos, max_videos,
  max_video_duration, max_audios, max_audio_duration, allow_photo_deletion,
  allow_photo_sharing, allow_video_recording, allow_audio_recording,
  allow_image_attachment, allow_video_attachment, like_counting_enabled,
  show_legal_text, legal_text_type, custom_terms_text, custom_privacy_text,
  gallery_view_mode, header_style, filter_type, font_family, font_size,
  custom_image_url, background_image_url, language, timezone, country_code,
  plan_id, type, is_demo, folder_id, limits_json,
  qr_password_required_camera, qr_password_required_gallery, updated_at
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
  public.sanitize_public_event_limits(e.limits_json),
  (
    COALESCE(e.limits_json ->> 'qr_password_enabled', 'false') = 'true'
    AND NULLIF(e.limits_json ->> 'qr_password_hash', '') IS NOT NULL
    AND CASE
      WHEN jsonb_typeof(e.limits_json -> 'qr_password_scope') = 'object'
        THEN COALESCE(e.limits_json #>> '{qr_password_scope,camera}', 'false') = 'true'
      ELSE true
    END
  ),
  (
    COALESCE(e.limits_json ->> 'qr_password_enabled', 'false') = 'true'
    AND NULLIF(e.limits_json ->> 'qr_password_hash', '') IS NOT NULL
    AND CASE
      WHEN jsonb_typeof(e.limits_json -> 'qr_password_scope') = 'object'
        THEN COALESCE(e.limits_json #>> '{qr_password_scope,gallery}', 'false') = 'true'
      ELSE true
    END
  ),
  now()
FROM public.events e
ON CONFLICT (event_id) DO UPDATE SET
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
  qr_password_required_camera = EXCLUDED.qr_password_required_camera,
  qr_password_required_gallery = EXCLUDED.qr_password_required_gallery,
  updated_at = EXCLUDED.updated_at;

DROP FUNCTION IF EXISTS public.verify_event_qr_password(uuid, text, text);
CREATE FUNCTION public.verify_event_qr_password(
  target_event_id uuid,
  target_scope text,
  candidate_password text
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
  SELECT e.limits_json
  INTO limits
  FROM public.events e
  WHERE e.id = target_event_id;

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
    scope_required := COALESCE((scope ->> target_scope)::boolean, false);
  END IF;

  IF NOT scope_required THEN
    RETURN true;
  END IF;

  RETURN encode(digest(COALESCE(candidate_password, ''), 'sha256'), 'hex') = expected_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_event_qr_password(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_event_qr_password(uuid, text, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.verify_event_qr_password(uuid, text, text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.resolve_public_event_access(text);
CREATE FUNCTION public.resolve_public_event_access(
  candidate_password text
)
RETURNS TABLE (
  id uuid,
  name text,
  language text,
  timezone text,
  reveal_time timestamptz,
  qr_password_required_camera boolean,
  qr_password_required_gallery boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.event_id AS id,
    c.name,
    c.language,
    c.timezone,
    c.reveal_time,
    c.qr_password_required_camera,
    c.qr_password_required_gallery
  FROM public.events e
  JOIN public.public_event_configs c ON c.event_id = e.id
  WHERE e.admin_password = candidate_password
     OR e.password_hash = candidate_password
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_event_access(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_public_event_access(text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.resolve_public_event_access(text) TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'public_event_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.public_event_configs;
  END IF;
END
$$;

ALTER TABLE public.public_event_configs REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';
-- Fix: verify_event_qr_password must return false for unknown events, invalid scopes
-- and events without QR password protection.
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