-- Add upload period columns to events table
ALTER TABLE public.events 
ADD COLUMN upload_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN upload_end_time TIMESTAMP WITH TIME ZONE;

-- Set default values for existing events (start now, end at reveal time)
UPDATE public.events 
SET upload_start_time = created_at,
    upload_end_time = reveal_time
WHERE upload_start_time IS NULL;