ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS experience_version text NOT NULL DEFAULT 'legacy';

-- The existing shared v2 game already uses the new interface. Events created
-- after this rollout was prepared also opt in if the migration is applied
-- later; every event that was already running remains on the original design.
UPDATE public.captains_events
SET experience_version = 'v2'
WHERE slug = 'demo-capitanes-v2'
   OR created_at >= timestamptz '2026-09-05T15:12:22Z';

ALTER TABLE public.captains_events
  ALTER COLUMN experience_version SET DEFAULT 'v2';

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_experience_version_check,
  ADD CONSTRAINT captains_events_experience_version_check
    CHECK (experience_version IN ('legacy', 'v2'));

COMMENT ON COLUMN public.captains_events.experience_version IS
  'Selects the public Capitanes interface. Existing events are legacy; new events default to v2.';

NOTIFY pgrst, 'reload schema';