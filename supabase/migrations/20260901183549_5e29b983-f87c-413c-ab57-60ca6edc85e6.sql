CREATE INDEX IF NOT EXISTS photos_event_id_idx ON public.photos (event_id);
CREATE INDEX IF NOT EXISTS videos_event_id_idx ON public.videos (event_id);
CREATE INDEX IF NOT EXISTS audios_event_id_idx ON public.audios (event_id);

CREATE OR REPLACE FUNCTION public.get_event_media_counts_batch(target_event_ids uuid[])
RETURNS TABLE(
  event_id uuid,
  photo_count integer,
  video_count integer,
  audio_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id AS event_id,
    (SELECT count(*)::integer FROM public.photos p WHERE p.event_id = e.id) AS photo_count,
    (SELECT count(*)::integer FROM public.videos v WHERE v.event_id = e.id) AS video_count,
    (SELECT count(*)::integer FROM public.audios a WHERE a.event_id = e.id) AS audio_count
  FROM public.events e
  WHERE e.id = ANY(coalesce(target_event_ids, ARRAY[]::uuid[]));
$$;

REVOKE ALL ON FUNCTION public.get_event_media_counts_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_media_counts_batch(uuid[]) TO anon, authenticated, service_role;