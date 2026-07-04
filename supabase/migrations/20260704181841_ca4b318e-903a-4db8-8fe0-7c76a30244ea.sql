ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS theme_style text NOT NULL DEFAULT 'pixel';

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_theme_style_check;

ALTER TABLE public.captains_events
  ADD CONSTRAINT captains_events_theme_style_check
  CHECK (theme_style IN ('pixel','romantic','modern','classic'));

NOTIFY pgrst, 'reload schema';