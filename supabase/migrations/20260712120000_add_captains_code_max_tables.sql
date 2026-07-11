ALTER TABLE public.captains_creation_codes
  ADD COLUMN IF NOT EXISTS max_tables integer;

UPDATE public.captains_creation_codes
SET max_tables = 30
WHERE max_tables IS NULL;

ALTER TABLE public.captains_creation_codes
  ALTER COLUMN max_tables SET NOT NULL,
  ADD CONSTRAINT captains_creation_codes_max_tables_check
  CHECK (max_tables BETWEEN 1 AND 999);

