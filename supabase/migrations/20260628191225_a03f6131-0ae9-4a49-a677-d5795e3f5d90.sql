
CREATE OR REPLACE FUNCTION public.captains_event_status(
  p_start_time timestamptz,
  p_end_time timestamptz
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_end_time IS NOT NULL AND now() >= p_end_time THEN 'finished'
    WHEN p_start_time IS NOT NULL AND now() < p_start_time THEN 'scheduled'
    ELSE 'active'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.captains_event_status(timestamptz, timestamptz)
  TO anon, authenticated, service_role;

-- Drop in dependency order (all tables are empty)
DROP TABLE IF EXISTS public.captains_evidence CASCADE;
DROP TABLE IF EXISTS public.captains_table_challenges CASCADE;
DROP TABLE IF EXISTS public.captains_table_accesses CASCADE;
DROP TABLE IF EXISTS public.captains_event_challenges CASCADE;
DROP TABLE IF EXISTS public.captains_tables CASCADE;
DROP TABLE IF EXISTS public.captains_events CASCADE;
DROP TABLE IF EXISTS public.captains_challenge_catalog CASCADE;

-- =========================================================
-- captains_events
-- =========================================================
CREATE TABLE public.captains_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  scoring_mode text NOT NULL DEFAULT 'automatic',
  status text NOT NULL DEFAULT 'draft',
  show_live_gallery_after_completion boolean NOT NULL DEFAULT true,
  public_url text,
  qr_url text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.captains_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_events TO authenticated;
GRANT ALL ON public.captains_events TO service_role;
ALTER TABLE public.captains_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage captains events" ON public.captains_events
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read visible captains events" ON public.captains_events
  FOR SELECT USING (
    public.captains_event_status(start_time, end_time)
      = ANY (ARRAY['scheduled','active','finished'])
  );
CREATE TRIGGER captains_events_set_updated_at
  BEFORE UPDATE ON public.captains_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- captains_challenge_catalog
-- =========================================================
CREATE TABLE public.captains_challenge_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  evidence_type text NOT NULL DEFAULT 'photo',
  default_points integer NOT NULL DEFAULT 10,
  category text,
  difficulty text,
  has_time_limit boolean NOT NULL DEFAULT false,
  time_limit_seconds integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.captains_challenge_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_challenge_catalog TO authenticated;
GRANT ALL ON public.captains_challenge_catalog TO service_role;
ALTER TABLE public.captains_challenge_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active catalog" ON public.captains_challenge_catalog
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage catalog" ON public.captains_challenge_catalog
  TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER captains_catalog_set_updated_at
  BEFORE UPDATE ON public.captains_challenge_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- captains_tables
-- =========================================================
CREATE TABLE public.captains_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  table_name text NOT NULL,
  captain_name text,
  active_captain_name text,
  session_token text,
  total_points integer NOT NULL DEFAULT 0,
  completed_challenges integer NOT NULL DEFAULT 0,
  failed_challenges integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, table_number)
);
CREATE INDEX captains_tables_event_idx ON public.captains_tables(event_id);
GRANT SELECT ON public.captains_tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_tables TO authenticated;
GRANT ALL ON public.captains_tables TO service_role;
ALTER TABLE public.captains_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage captains tables" ON public.captains_tables
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read tables of visible events" ON public.captains_tables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_tables.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active','finished'])
    )
  );
CREATE POLICY "Public can update tables of scheduled/active events" ON public.captains_tables
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_tables.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active'])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_tables.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active'])
    )
  );
CREATE TRIGGER captains_tables_set_updated_at
  BEFORE UPDATE ON public.captains_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- captains_event_challenges
-- =========================================================
CREATE TABLE public.captains_event_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  catalog_challenge_id uuid REFERENCES public.captains_challenge_catalog(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  evidence_type text NOT NULL DEFAULT 'photo',
  points integer NOT NULL DEFAULT 10,
  category text,
  difficulty text,
  has_time_limit boolean NOT NULL DEFAULT false,
  time_limit_seconds integer,
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX captains_event_challenges_event_idx ON public.captains_event_challenges(event_id);
GRANT SELECT ON public.captains_event_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_event_challenges TO authenticated;
GRANT ALL ON public.captains_event_challenges TO service_role;
ALTER TABLE public.captains_event_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage event challenges" ON public.captains_event_challenges
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read challenges of visible events" ON public.captains_event_challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_event_challenges.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active','finished'])
    )
  );
CREATE TRIGGER captains_event_challenges_set_updated_at
  BEFORE UPDATE ON public.captains_event_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- captains_table_challenges
-- =========================================================
CREATE TABLE public.captains_table_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.captains_event_challenges(id) ON DELETE CASCADE,
  randomized_order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  points_awarded integer NOT NULL DEFAULT 0,
  elapsed_seconds integer,
  remaining_seconds integer,
  is_time_expired boolean NOT NULL DEFAULT false,
  automatic_score_calculated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_id, challenge_id)
);
CREATE INDEX captains_table_challenges_event_idx ON public.captains_table_challenges(event_id);
CREATE INDEX captains_table_challenges_table_idx ON public.captains_table_challenges(table_id);
GRANT SELECT ON public.captains_table_challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_table_challenges TO authenticated;
GRANT ALL ON public.captains_table_challenges TO service_role;
ALTER TABLE public.captains_table_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage table challenges" ON public.captains_table_challenges
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read table challenges of visible events" ON public.captains_table_challenges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_table_challenges.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active','finished'])
    )
  );
CREATE POLICY "Public can insert table challenges of active events" ON public.captains_table_challenges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_table_challenges.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active'])
    )
  );
CREATE POLICY "Public can update table challenges of active events" ON public.captains_table_challenges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_table_challenges.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active'])
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_table_challenges.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active'])
    )
  );
CREATE TRIGGER captains_table_challenges_set_updated_at
  BEFORE UPDATE ON public.captains_table_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- captains_evidence
-- =========================================================
CREATE TABLE public.captains_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  table_challenge_id uuid REFERENCES public.captains_table_challenges(id) ON DELETE SET NULL,
  captain_name text,
  evidence_type text NOT NULL DEFAULT 'photo',
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review',
  points_awarded integer NOT NULL DEFAULT 0,
  elapsed_seconds integer,
  remaining_seconds integer,
  admin_comment text,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX captains_evidence_event_idx ON public.captains_evidence(event_id);
CREATE INDEX captains_evidence_table_idx ON public.captains_evidence(table_id);
GRANT SELECT ON public.captains_evidence TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_evidence TO authenticated;
GRANT ALL ON public.captains_evidence TO service_role;
ALTER TABLE public.captains_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage evidence" ON public.captains_evidence
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can read evidence of visible events" ON public.captains_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_evidence.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active','finished'])
    )
  );
CREATE POLICY "Public can insert evidence of active events" ON public.captains_evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events e
      WHERE e.id = captains_evidence.event_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active'])
    )
  );
CREATE TRIGGER captains_evidence_set_updated_at
  BEFORE UPDATE ON public.captains_evidence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- captains_table_accesses
-- =========================================================
CREATE TABLE public.captains_table_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  table_name text,
  captain_name text,
  session_token text,
  selected_at timestamptz,
  device_id text,
  user_agent text,
  device_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX captains_table_accesses_table_idx ON public.captains_table_accesses(table_id);
GRANT SELECT ON public.captains_table_accesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_table_accesses TO authenticated;
GRANT ALL ON public.captains_table_accesses TO service_role;
ALTER TABLE public.captains_table_accesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage table accesses" ON public.captains_table_accesses
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can insert table accesses" ON public.captains_table_accesses
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read table accesses of visible events" ON public.captains_table_accesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.captains_tables t
      JOIN public.captains_events e ON e.id = t.event_id
      WHERE t.id = captains_table_accesses.table_id
        AND public.captains_event_status(e.start_time, e.end_time)
            = ANY (ARRAY['scheduled','active','finished'])
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
