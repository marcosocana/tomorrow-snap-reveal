-- Add like counting mode column to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS like_counting_enabled boolean NOT NULL DEFAULT false;

-- Add device_id to photo_likes for tracking unique likes per device
ALTER TABLE public.photo_likes 
ADD COLUMN IF NOT EXISTS device_id text;