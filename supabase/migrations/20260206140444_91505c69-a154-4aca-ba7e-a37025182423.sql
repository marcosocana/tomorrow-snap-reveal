-- Add allow_photo_sharing column to events table
-- Default is TRUE (sharing enabled by default)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS allow_photo_sharing boolean NOT NULL DEFAULT true;