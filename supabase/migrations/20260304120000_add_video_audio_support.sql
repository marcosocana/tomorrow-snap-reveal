-- Add video and audio settings to events and create media tables
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_video_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_videos integer,
  ADD COLUMN IF NOT EXISTS max_video_duration integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS allow_audio_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_audios integer,
  ADD COLUMN IF NOT EXISTS max_audio_duration integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.events.allow_video_recording IS 'Whether the event accepts attendee video recordings';
COMMENT ON COLUMN public.events.max_videos IS 'Maximum number of videos allowed for the event';
COMMENT ON COLUMN public.events.max_video_duration IS 'Max duration in seconds for the allowed videos';
COMMENT ON COLUMN public.events.allow_audio_recording IS 'Whether the event accepts attendee audio notes';
COMMENT ON COLUMN public.events.max_audios IS 'Maximum number of audio notes allowed for the event';
COMMENT ON COLUMN public.events.max_audio_duration IS 'Max duration in seconds for the allowed audio notes';

CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upload videos to events"
  ON public.videos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Videos visible after reveal"
  ON public.videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events
      WHERE events.id = videos.event_id
        AND events.reveal_time <= now()
    )
  );

CREATE POLICY "Anyone can upload audio notes"
  ON public.audios
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Audio notes visible after reveal"
  ON public.audios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events
      WHERE events.id = audios.event_id
        AND events.reveal_time <= now()
    )
  );

INSERT INTO storage.buckets (id, name, "public")
VALUES ('event-videos', 'event-videos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, "public")
VALUES ('event-audio', 'event-audio', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload videos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'event-videos');

CREATE POLICY "Videos accessible after reveal"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'event-videos' AND
    EXISTS (
      SELECT 1
      FROM public.videos v
      JOIN public.events e ON v.event_id = e.id
      WHERE v.video_url = storage.objects.name
        AND e.reveal_time <= now()
    )
  );

CREATE POLICY "Anyone can upload audio notes"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'event-audio');

CREATE POLICY "Audio notes accessible after reveal"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'event-audio' AND
    EXISTS (
      SELECT 1
      FROM public.audios a
      JOIN public.events e ON a.event_id = e.id
      WHERE a.audio_url = storage.objects.name
        AND e.reveal_time <= now()
    )
  );
