-- Add background_image_url column to events table
-- This will be used as the hero background image for gallery and camera screens
ALTER TABLE public.events 
ADD COLUMN background_image_url text;