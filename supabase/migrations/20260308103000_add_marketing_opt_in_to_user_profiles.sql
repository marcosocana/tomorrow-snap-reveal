ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT true;

UPDATE public.user_profiles
SET marketing_opt_in = true
WHERE marketing_opt_in IS NULL;
