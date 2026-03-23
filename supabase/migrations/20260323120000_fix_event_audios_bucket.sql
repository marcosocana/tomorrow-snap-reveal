-- Normalize audio storage to the bucket used by the frontend.
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-audios', 'event-audios', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

-- Remove the mistaken singular bucket if it exists and is empty.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'event-audio'
  ) AND NOT EXISTS (
    SELECT 1
    FROM storage.objects
    WHERE bucket_id = 'event-audio'
  ) THEN
    DELETE FROM storage.buckets
    WHERE id = 'event-audio';
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can upload audio notes" ON storage.objects;
DROP POLICY IF EXISTS "Audio notes accessible after reveal" ON storage.objects;
DROP POLICY IF EXISTS "Public read event-audios" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload event-audios" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete event-audios" ON storage.objects;

CREATE POLICY "Anyone can upload event-audios"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'event-audios');

CREATE POLICY "Event audios accessible after reveal"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'event-audios' AND
    EXISTS (
      SELECT 1
      FROM public.audios a
      JOIN public.events e ON a.event_id = e.id
      WHERE a.audio_url = storage.objects.name
        AND e.reveal_time <= now()
    )
  );

CREATE POLICY "Anyone can delete event-audios"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'event-audios');
