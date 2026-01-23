-- Add font_size column to events table for custom typography size
ALTER TABLE public.events
ADD COLUMN font_size text NOT NULL DEFAULT 'text-3xl';