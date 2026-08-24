-- Every event creation path should inherit legal text as opt-in. Existing
-- events keep their current value and can still enable the option when edited.
ALTER TABLE public.events
  ALTER COLUMN show_legal_text SET DEFAULT false;
