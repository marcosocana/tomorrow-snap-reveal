
-- =========================================================
-- 1) Helper: derive event status from start_time / end_time
-- =========================================================
CREATE OR REPLACE FUNCTION public.captains_event_status(_start timestamptz, _end timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _start IS NULL THEN 'scheduled'
    WHEN now() < _start THEN 'scheduled'
    WHEN _end IS NOT NULL AND now() >= _end THEN 'finished'
    ELSE 'active'
  END
$$;

-- =========================================================
-- 2) captains_events
-- =========================================================
CREATE TABLE public.captains_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  show_live_gallery_after_completion boolean NOT NULL DEFAULT true,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.captains_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_events TO authenticated;
GRANT ALL ON public.captains_events TO service_role;

ALTER TABLE public.captains_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read scheduled/active/finished captains events"
  ON public.captains_events FOR SELECT
  USING (public.captains_event_status(start_time, end_time) IN ('scheduled','active','finished'));

CREATE POLICY "Authenticated can manage captains events"
  ON public.captains_events FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER captains_events_set_updated_at
  BEFORE UPDATE ON public.captains_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3) captains_tables
-- =========================================================
CREATE TABLE public.captains_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captains_event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  name text NOT NULL,
  captain_name text,
  position integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX captains_tables_event_idx ON public.captains_tables(captains_event_id);

GRANT SELECT ON public.captains_tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_tables TO authenticated;
GRANT ALL ON public.captains_tables TO service_role;

-- Anon needs UPDATE on tables to bump score / completed_at while playing
GRANT UPDATE ON public.captains_tables TO anon;

ALTER TABLE public.captains_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read tables of visible captains events"
  ON public.captains_tables FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.captains_events e
    WHERE e.id = captains_event_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active','finished')
  ));

CREATE POLICY "Public can update tables of scheduled/active captains events"
  ON public.captains_tables FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.captains_events e
    WHERE e.id = captains_event_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_events e
    WHERE e.id = captains_event_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  ));

CREATE POLICY "Authenticated can manage captains tables"
  ON public.captains_tables FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER captains_tables_set_updated_at
  BEFORE UPDATE ON public.captains_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4) captains_challenge_catalog
-- =========================================================
CREATE TABLE public.captains_challenge_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  default_points integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.captains_challenge_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_challenge_catalog TO authenticated;
GRANT ALL ON public.captains_challenge_catalog TO service_role;

ALTER TABLE public.captains_challenge_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active challenge catalog"
  ON public.captains_challenge_catalog FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated can manage challenge catalog"
  ON public.captains_challenge_catalog FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER captains_challenge_catalog_set_updated_at
  BEFORE UPDATE ON public.captains_challenge_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5) captains_event_challenges
-- =========================================================
CREATE TABLE public.captains_event_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captains_event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  catalog_id uuid REFERENCES public.captains_challenge_catalog(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  points integer NOT NULL DEFAULT 10,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX captains_event_challenges_event_idx ON public.captains_event_challenges(captains_event_id);

GRANT SELECT ON public.captains_event_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_event_challenges TO authenticated;
GRANT ALL ON public.captains_event_challenges TO service_role;

ALTER TABLE public.captains_event_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read event challenges of visible events"
  ON public.captains_event_challenges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.captains_events e
    WHERE e.id = captains_event_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active','finished')
  ));

CREATE POLICY "Authenticated can manage event challenges"
  ON public.captains_event_challenges FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER captains_event_challenges_set_updated_at
  BEFORE UPDATE ON public.captains_event_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 6) captains_table_challenges (progress per table)
-- =========================================================
CREATE TABLE public.captains_table_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  event_challenge_id uuid NOT NULL REFERENCES public.captains_event_challenges(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  awarded_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, event_challenge_id)
);

CREATE INDEX captains_table_challenges_table_idx ON public.captains_table_challenges(table_id);

GRANT SELECT, INSERT, UPDATE ON public.captains_table_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_table_challenges TO authenticated;
GRANT ALL ON public.captains_table_challenges TO service_role;

ALTER TABLE public.captains_table_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read table progress of visible events"
  ON public.captains_table_challenges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.captains_tables t
    JOIN public.captains_events e ON e.id = t.captains_event_id
    WHERE t.id = table_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active','finished')
  ));

CREATE POLICY "Public can insert table progress on scheduled/active events"
  ON public.captains_table_challenges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_tables t
    JOIN public.captains_events e ON e.id = t.captains_event_id
    WHERE t.id = table_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  ));

CREATE POLICY "Public can update table progress on scheduled/active events"
  ON public.captains_table_challenges FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.captains_tables t
    JOIN public.captains_events e ON e.id = t.captains_event_id
    WHERE t.id = table_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_tables t
    JOIN public.captains_events e ON e.id = t.captains_event_id
    WHERE t.id = table_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  ));

CREATE POLICY "Authenticated can manage table progress"
  ON public.captains_table_challenges FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER captains_table_challenges_set_updated_at
  BEFORE UPDATE ON public.captains_table_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 7) captains_evidence
-- =========================================================
CREATE TABLE public.captains_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  event_challenge_id uuid REFERENCES public.captains_event_challenges(id) ON DELETE SET NULL,
  table_challenge_id uuid REFERENCES public.captains_table_challenges(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_url text,
  media_type text NOT NULL DEFAULT 'image',
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | deleted
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX captains_evidence_table_idx ON public.captains_evidence(table_id);
CREATE INDEX captains_evidence_status_idx ON public.captains_evidence(status);

GRANT SELECT, INSERT ON public.captains_evidence TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_evidence TO authenticated;
GRANT ALL ON public.captains_evidence TO service_role;

ALTER TABLE public.captains_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read non-deleted/rejected evidence on visible events"
  ON public.captains_evidence FOR SELECT
  USING (
    status NOT IN ('deleted','rejected')
    AND EXISTS (
      SELECT 1 FROM public.captains_tables t
      JOIN public.captains_events e ON e.id = t.captains_event_id
      WHERE t.id = table_id
        AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active','finished')
    )
  );

CREATE POLICY "Public can insert evidence on scheduled/active events"
  ON public.captains_evidence FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_tables t
    JOIN public.captains_events e ON e.id = t.captains_event_id
    WHERE t.id = table_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  ));

CREATE POLICY "Authenticated can manage evidence"
  ON public.captains_evidence FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER captains_evidence_set_updated_at
  BEFORE UPDATE ON public.captains_evidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 8) captains_table_accesses
-- =========================================================
CREATE TABLE public.captains_table_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  device_id text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX captains_table_accesses_table_idx ON public.captains_table_accesses(table_id);

GRANT SELECT, INSERT ON public.captains_table_accesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_table_accesses TO authenticated;
GRANT ALL ON public.captains_table_accesses TO service_role;

ALTER TABLE public.captains_table_accesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert table accesses"
  ON public.captains_table_accesses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can read table accesses of visible events"
  ON public.captains_table_accesses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.captains_tables t
    JOIN public.captains_events e ON e.id = t.captains_event_id
    WHERE t.id = table_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active','finished')
  ));

CREATE POLICY "Authenticated can manage table accesses"
  ON public.captains_table_accesses FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- =========================================================
-- 9) Storage policies for the captains-evidence bucket
-- =========================================================
CREATE POLICY "Public can upload to captains-evidence"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'captains-evidence');

CREATE POLICY "Public can read captains-evidence"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'captains-evidence');

CREATE POLICY "Authenticated can update captains-evidence"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'captains-evidence')
  WITH CHECK (bucket_id = 'captains-evidence');

CREATE POLICY "Authenticated can delete captains-evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'captains-evidence');
