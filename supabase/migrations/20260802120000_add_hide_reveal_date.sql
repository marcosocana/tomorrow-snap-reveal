ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS hide_reveal_date boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.hide_reveal_date IS
  'Whether the reveal date message is hidden while the event is in progress';
