-- Add country and timezone columns to events table
ALTER TABLE public.events 
ADD COLUMN country_code text NOT NULL DEFAULT 'ES',
ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Madrid';