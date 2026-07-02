ALTER TABLE public.captains_tables
ADD COLUMN IF NOT EXISTS captain_photo_url text;

COMMENT ON COLUMN public.captains_tables.captain_photo_url IS 'Public URL for the table captain photo shown only in the table selection screen.';

NOTIFY pgrst, 'reload schema';
