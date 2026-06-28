ALTER TABLE public.captains_events
ADD COLUMN IF NOT EXISTS end_time timestamptz;
