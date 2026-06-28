ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS background_image_url text;

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_primary_color_check,
  ADD CONSTRAINT captains_events_primary_color_check
    CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_secondary_color_check,
  ADD CONSTRAINT captains_events_secondary_color_check
    CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$');
