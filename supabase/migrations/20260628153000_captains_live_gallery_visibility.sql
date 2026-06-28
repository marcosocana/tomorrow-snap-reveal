ALTER TABLE public.captains_events
ADD COLUMN IF NOT EXISTS show_live_gallery_after_completion boolean NOT NULL DEFAULT true;
