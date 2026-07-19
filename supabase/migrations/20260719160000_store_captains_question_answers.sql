ALTER TABLE public.captains_table_challenges
  ADD COLUMN IF NOT EXISTS question_answer text;

COMMENT ON COLUMN public.captains_table_challenges.question_answer IS
  'Answer selected by the table when completing a question challenge.';

NOTIFY pgrst, 'reload schema';
