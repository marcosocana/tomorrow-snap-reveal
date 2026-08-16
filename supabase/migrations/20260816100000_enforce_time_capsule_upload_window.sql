-- Enforce the wedding recording window for time-capsule videos.
-- Other event types keep their existing public upload behaviour.

-- The X-year opening date lives only in limits_json.capsule.years and is
-- informational. Avoid coupling it to reveal/expiry behaviour in the generic
-- event system, including for capsules created before this migration.
UPDATE public.events
SET
  reveal_time = upload_end_time,
  expiry_date = NULL
WHERE
  (
    COALESCE(plan_id = 'capsule', false)
    OR COALESCE(type = 'capsule', false)
  )
  AND upload_end_time IS NOT NULL;

DROP POLICY IF EXISTS "Anyone can upload videos" ON public.videos;
DROP POLICY IF EXISTS "Anyone can upload videos to events" ON public.videos;
DROP POLICY IF EXISTS "Upload videos during event window" ON public.videos;

CREATE POLICY "Upload videos during event window"
  ON public.videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events AS event
      WHERE event.id = videos.event_id
        AND (
          NOT (
            COALESCE(event.plan_id = 'capsule', false)
            OR COALESCE(event.type = 'capsule', false)
          )
          OR (
            event.upload_start_time IS NOT NULL
            AND event.upload_end_time IS NOT NULL
            AND now() BETWEEN event.upload_start_time AND event.upload_end_time
          )
        )
    )
  );

DROP POLICY IF EXISTS "Anyone can upload event-videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Upload event videos during event window" ON storage.objects;

CREATE POLICY "Upload event videos during event window"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'event-videos'
    AND EXISTS (
      SELECT 1
      FROM public.events AS event
      WHERE event.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          NOT (
            COALESCE(event.plan_id = 'capsule', false)
            OR COALESCE(event.type = 'capsule', false)
          )
          OR (
            event.upload_start_time IS NOT NULL
            AND event.upload_end_time IS NOT NULL
            AND now() BETWEEN event.upload_start_time AND event.upload_end_time
          )
        )
    )
  );
