-- Add gallery view mode column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS gallery_view_mode text NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN public.events.gallery_view_mode IS 'Gallery display mode: normal (current scroll view) or grid (iPhone-style grid)';