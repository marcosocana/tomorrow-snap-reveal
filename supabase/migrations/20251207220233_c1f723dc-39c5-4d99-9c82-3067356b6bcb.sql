-- Add filter_type column to events table
ALTER TABLE public.events 
ADD COLUMN filter_type text NOT NULL DEFAULT 'vintage';

-- Add comment for clarity
COMMENT ON COLUMN public.events.filter_type IS 'Filter type for event photos: vintage, 35mm, none';