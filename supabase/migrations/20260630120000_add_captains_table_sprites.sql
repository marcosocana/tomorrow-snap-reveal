ALTER TABLE public.captains_tables
  ADD COLUMN IF NOT EXISTS captain_sprite text,
  ADD COLUMN IF NOT EXISTS captain_sprite_config jsonb;

ALTER TABLE public.captains_tables
  DROP CONSTRAINT IF EXISTS captains_tables_captain_sprite_check;

ALTER TABLE public.captains_tables
  ADD CONSTRAINT captains_tables_captain_sprite_check
  CHECK (
    captain_sprite IS NULL
    OR captain_sprite IN (
      'suit',
      'dress',
      'jacket',
      'skirt',
      'festival',
      'tunic',
      'uniform',
      'kimono'
    )
  );
