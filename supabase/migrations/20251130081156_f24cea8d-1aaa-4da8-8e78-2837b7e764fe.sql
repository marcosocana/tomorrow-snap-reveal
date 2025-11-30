-- Add custom_image_url column to events table
ALTER TABLE public.events ADD COLUMN custom_image_url TEXT;

COMMENT ON COLUMN public.events.custom_image_url IS 'URL of custom image to display for this event';
