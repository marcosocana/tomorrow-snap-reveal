ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_image_attachment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_video_attachment boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.allow_image_attachment IS 'Whether attendees can attach photos from their gallery during the event';
COMMENT ON COLUMN public.events.allow_video_attachment IS 'Whether attendees can attach videos from their gallery during the event';
