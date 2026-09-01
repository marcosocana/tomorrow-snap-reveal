-- Fetch media counters for an event list in one RPC. This preserves the
-- existing public count semantics while avoiding one request per event.
CREATE OR REPLACE FUNCTION public.get_event_media_counts_batch(target_event_ids uuid[])
RETURNS TABLE (
  event_id uuid,
  photo_count integer,
  video_count integer,
  audio_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH requested_events AS MATERIALIZED (
    SELECT DISTINCT events.id AS event_id
    FROM unnest(coalesce(target_event_ids, ARRAY[]::uuid[])) AS requested(event_id)
    JOIN public.events AS events ON events.id = requested.event_id
  ),
  photo_counts AS (
    SELECT photos.event_id, count(*)::integer AS media_count
    FROM public.photos AS photos
    JOIN requested_events USING (event_id)
    GROUP BY photos.event_id
  ),
  video_counts AS (
    SELECT videos.event_id, count(*)::integer AS media_count
    FROM public.videos AS videos
    JOIN requested_events USING (event_id)
    GROUP BY videos.event_id
  ),
  audio_counts AS (
    SELECT audios.event_id, count(*)::integer AS media_count
    FROM public.audios AS audios
    JOIN requested_events USING (event_id)
    GROUP BY audios.event_id
  )
  SELECT
    requested_events.event_id,
    coalesce(photo_counts.media_count, 0) AS photo_count,
    coalesce(video_counts.media_count, 0) AS video_count,
    coalesce(audio_counts.media_count, 0) AS audio_count
  FROM requested_events
  LEFT JOIN photo_counts USING (event_id)
  LEFT JOIN video_counts USING (event_id)
  LEFT JOIN audio_counts USING (event_id);
$$;

REVOKE ALL ON FUNCTION public.get_event_media_counts_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_media_counts_batch(uuid[])
  TO anon, authenticated, service_role;

-- PostgreSQL does not automatically index foreign-key columns. These indexes
-- keep both the new batch aggregation and the existing single-event RPC from
-- scanning each complete media table.
CREATE INDEX IF NOT EXISTS photos_event_id_idx ON public.photos (event_id);
CREATE INDEX IF NOT EXISTS videos_event_id_idx ON public.videos (event_id);
CREATE INDEX IF NOT EXISTS audios_event_id_idx ON public.audios (event_id);
