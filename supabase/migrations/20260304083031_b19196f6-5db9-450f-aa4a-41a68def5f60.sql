
-- 1. Add video/audio config columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_video_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_videos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_video_duration integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS allow_audio_recording boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_audios integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_audio_duration integer NOT NULL DEFAULT 30;

-- 2. Create videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upload videos" ON public.videos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "Anyone can delete videos" ON public.videos FOR DELETE USING (true);

-- 3. Create audios table
CREATE TABLE IF NOT EXISTS public.audios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  duration_seconds integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upload audios" ON public.audios FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read audios" ON public.audios FOR SELECT USING (true);
CREATE POLICY "Anyone can delete audios" ON public.audios FOR DELETE USING (true);

-- 4. Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('event-videos', 'event-videos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('event-audios', 'event-audios', true) ON CONFLICT (id) DO NOTHING;

-- 5. Storage RLS for event-videos
CREATE POLICY "Public read event-videos" ON storage.objects FOR SELECT USING (bucket_id = 'event-videos');
CREATE POLICY "Anyone can upload event-videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-videos');
CREATE POLICY "Anyone can delete event-videos" ON storage.objects FOR DELETE USING (bucket_id = 'event-videos');

-- 6. Storage RLS for event-audios
CREATE POLICY "Public read event-audios" ON storage.objects FOR SELECT USING (bucket_id = 'event-audios');
CREATE POLICY "Anyone can upload event-audios" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-audios');
CREATE POLICY "Anyone can delete event-audios" ON storage.objects FOR DELETE USING (bucket_id = 'event-audios');

-- 7. Enable realtime for videos and audios
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audios;
