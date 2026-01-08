-- Add is_demo column to events table
ALTER TABLE public.events 
ADD COLUMN is_demo boolean NOT NULL DEFAULT false;