ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_description_max_length;

ALTER TABLE public.events
  ADD CONSTRAINT events_description_max_length CHECK (char_length(description) <= 300);