-- Create table for video likes
CREATE TABLE IF NOT EXISTS public.video_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  device_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_likes' AND policyname = 'Anyone can read video likes'
  ) THEN
    CREATE POLICY "Anyone can read video likes"
    ON public.video_likes
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'video_likes' AND policyname = 'Anyone can add video likes'
  ) THEN
    CREATE POLICY "Anyone can add video likes"
    ON public.video_likes
    FOR INSERT
    WITH CHECK (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_video_likes_video_id ON public.video_likes(video_id);

-- Create table for audio likes
CREATE TABLE IF NOT EXISTS public.audio_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_id uuid NOT NULL REFERENCES public.audios(id) ON DELETE CASCADE,
  device_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audio_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audio_likes' AND policyname = 'Anyone can read audio likes'
  ) THEN
    CREATE POLICY "Anyone can read audio likes"
    ON public.audio_likes
    FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audio_likes' AND policyname = 'Anyone can add audio likes'
  ) THEN
    CREATE POLICY "Anyone can add audio likes"
    ON public.audio_likes
    FOR INSERT
    WITH CHECK (true);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_audio_likes_audio_id ON public.audio_likes(audio_id);
