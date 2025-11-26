-- Add max_photos column to events table
ALTER TABLE public.events 
ADD COLUMN max_photos integer DEFAULT NULL;

COMMENT ON COLUMN public.events.max_photos IS 'Maximum number of photos allowed for this event. NULL means unlimited.';