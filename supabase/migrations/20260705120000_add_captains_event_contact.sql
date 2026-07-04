ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

CREATE INDEX IF NOT EXISTS captains_events_contact_email_idx
  ON public.captains_events(contact_email);
