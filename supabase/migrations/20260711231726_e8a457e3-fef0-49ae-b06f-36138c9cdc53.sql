ALTER TABLE public.captains_creation_codes
  ADD COLUMN IF NOT EXISTS max_tables integer;

UPDATE public.captains_creation_codes
SET max_tables = 30
WHERE max_tables IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'captains_creation_codes_max_tables_check'
      AND table_name = 'captains_creation_codes'
  ) THEN
    ALTER TABLE public.captains_creation_codes
      ALTER COLUMN max_tables SET NOT NULL,
      ADD CONSTRAINT captains_creation_codes_max_tables_check
      CHECK (max_tables BETWEEN 1 AND 999);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';