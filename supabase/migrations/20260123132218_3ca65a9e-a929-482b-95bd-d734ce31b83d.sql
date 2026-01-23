-- Add font_family column to events table for custom typography
ALTER TABLE public.events 
ADD COLUMN font_family text NOT NULL DEFAULT 'system';