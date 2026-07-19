ALTER TABLE public.captains_table_challenges
  ADD COLUMN IF NOT EXISTS question_answer text;

COMMENT ON COLUMN public.captains_table_challenges.question_answer IS
  'Answer selected by the table when completing a question challenge.';

GRANT UPDATE (question_answer)
  ON public.captains_table_challenges
  TO anon;

NOTIFY pgrst, 'reload schema';
