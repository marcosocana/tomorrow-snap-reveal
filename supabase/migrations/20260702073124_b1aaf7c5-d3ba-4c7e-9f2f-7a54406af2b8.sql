
ALTER TABLE public.captains_tables
  ADD COLUMN IF NOT EXISTS captain_photo_url text,
  ADD COLUMN IF NOT EXISTS captain_sprite text,
  ADD COLUMN IF NOT EXISTS captain_sprite_config jsonb,
  ADD COLUMN IF NOT EXISTS current_challenge_id uuid;

ALTER TABLE public.captains_event_challenges
  ADD COLUMN IF NOT EXISTS question_options jsonb,
  ADD COLUMN IF NOT EXISTS question_correct_option text;

ALTER TABLE public.captains_challenge_catalog
  ADD COLUMN IF NOT EXISTS question_options jsonb,
  ADD COLUMN IF NOT EXISTS question_correct_option text;

-- Ensure public insert policy on captains_evidence exists with correct grants
GRANT SELECT, INSERT ON public.captains_evidence TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_evidence TO authenticated;
GRANT ALL ON public.captains_evidence TO service_role;

NOTIFY pgrst, 'reload schema';
