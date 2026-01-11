-- Add description field to events table (max 200 characters)
ALTER TABLE public.events ADD COLUMN description text;

-- Add a check constraint for max length
ALTER TABLE public.events ADD CONSTRAINT events_description_max_length CHECK (char_length(description) <= 200);