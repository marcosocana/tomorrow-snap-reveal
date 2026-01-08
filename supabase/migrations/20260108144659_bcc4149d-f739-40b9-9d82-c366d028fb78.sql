-- Add language column to events table
ALTER TABLE public.events 
ADD COLUMN language text NOT NULL DEFAULT 'es';

-- Add comment for clarity
COMMENT ON COLUMN public.events.language IS 'Language code for event UI: es (Spanish), en (English), it (Italian)';