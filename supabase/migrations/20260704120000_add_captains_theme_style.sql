ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS theme_style text DEFAULT 'pixel';

UPDATE public.captains_events
SET theme_style = 'pixel'
WHERE theme_style IS NULL;

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_theme_style_check,
  ADD CONSTRAINT captains_events_theme_style_check
    CHECK (theme_style IS NULL OR theme_style IN ('pixel', 'romantic', 'modern', 'classic'));
