-- Guests need aggregate counts while individual videos and audio notes remain
-- hidden until reveal. Direct table counts are filtered by RLS and incorrectly
-- report zero before that point.
CREATE OR REPLACE FUNCTION public.get_event_media_counts(target_event_id uuid)
RETURNS TABLE (
  photo_count integer,
  video_count integer,
  audio_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::integer FROM public.photos WHERE event_id = target_event_id),
    (SELECT count(*)::integer FROM public.videos WHERE event_id = target_event_id),
    (SELECT count(*)::integer FROM public.audios WHERE event_id = target_event_id)
  WHERE EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = target_event_id
  );
$$;

REVOKE ALL ON FUNCTION public.get_event_media_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_media_counts(uuid) TO anon, authenticated, service_role;
