-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  reveal_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events (public read for checking password, anyone can create)
CREATE POLICY "Anyone can read events"
  ON public.events
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for photos (anyone can insert during event, read only after reveal time)
CREATE POLICY "Anyone can upload photos to events"
  ON public.photos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Photos visible after reveal time"
  ON public.photos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = photos.event_id 
      AND events.reveal_time <= now()
    )
  );

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', false);

-- Storage policies
CREATE POLICY "Anyone can upload photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'event-photos');

CREATE POLICY "Photos accessible after reveal"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'event-photos' AND
    EXISTS (
      SELECT 1 FROM public.photos p
      JOIN public.events e ON p.event_id = e.id
      WHERE p.image_url = storage.objects.name
      AND e.reveal_time <= now()
    )
  );