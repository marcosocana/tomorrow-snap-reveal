CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.captains_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  start_time timestamptz,
  scoring_mode text NOT NULL DEFAULT 'automatic',
  status text NOT NULL DEFAULT 'draft',
  qr_url text,
  public_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captains_events_scoring_mode_check CHECK (scoring_mode IN ('automatic', 'manual')),
  CONSTRAINT captains_events_status_check CHECK (status IN ('draft', 'scheduled', 'active', 'finished', 'archived'))
);

CREATE TABLE IF NOT EXISTS public.captains_challenge_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  description text NOT NULL,
  evidence_type text NOT NULL,
  category text NOT NULL,
  difficulty text NOT NULL,
  default_points integer NOT NULL DEFAULT 0,
  has_time_limit boolean NOT NULL DEFAULT false,
  time_limit_seconds integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captains_challenge_catalog_evidence_type_check CHECK (evidence_type IN ('photo', 'video', 'audio')),
  CONSTRAINT captains_challenge_catalog_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard', 'special')),
  CONSTRAINT captains_challenge_catalog_points_check CHECK (default_points >= 0),
  CONSTRAINT captains_challenge_catalog_time_check CHECK (
    (has_time_limit = false AND time_limit_seconds IS NULL)
    OR (has_time_limit = true AND time_limit_seconds IS NOT NULL AND time_limit_seconds > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.captains_event_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  catalog_challenge_id uuid REFERENCES public.captains_challenge_catalog(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  evidence_type text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  category text NOT NULL,
  difficulty text NOT NULL,
  has_time_limit boolean NOT NULL DEFAULT false,
  time_limit_seconds integer,
  order_index integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captains_event_challenges_evidence_type_check CHECK (evidence_type IN ('photo', 'video', 'audio')),
  CONSTRAINT captains_event_challenges_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard', 'special')),
  CONSTRAINT captains_event_challenges_points_check CHECK (points >= 0),
  CONSTRAINT captains_event_challenges_time_check CHECK (
    (has_time_limit = false AND time_limit_seconds IS NULL)
    OR (has_time_limit = true AND time_limit_seconds IS NOT NULL AND time_limit_seconds > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.captains_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_number integer NOT NULL,
  table_name text NOT NULL,
  captain_name text,
  active_captain_name text,
  session_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  total_points integer NOT NULL DEFAULT 0,
  completed_challenges integer NOT NULL DEFAULT 0,
  failed_challenges integer NOT NULL DEFAULT 0,
  current_challenge_id uuid REFERENCES public.captains_event_challenges(id) ON DELETE SET NULL,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captains_tables_table_number_check CHECK (table_number > 0),
  CONSTRAINT captains_tables_points_check CHECK (total_points >= 0),
  CONSTRAINT captains_tables_completed_check CHECK (completed_challenges >= 0),
  CONSTRAINT captains_tables_failed_check CHECK (failed_challenges >= 0),
  CONSTRAINT captains_tables_event_number_unique UNIQUE (event_id, table_number)
);

CREATE TABLE IF NOT EXISTS public.captains_table_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.captains_event_challenges(id) ON DELETE CASCADE,
  randomized_order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  points_awarded integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  submitted_at timestamptz,
  elapsed_seconds integer,
  remaining_seconds integer,
  is_time_expired boolean NOT NULL DEFAULT false,
  automatic_score_calculated boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT captains_table_challenges_status_check CHECK (
    status IN ('pending', 'ready', 'in_progress', 'submitted', 'completed', 'failed', 'time_expired', 'pending_review', 'rejected', 'deleted')
  ),
  CONSTRAINT captains_table_challenges_points_check CHECK (points_awarded >= 0),
  CONSTRAINT captains_table_challenges_elapsed_check CHECK (elapsed_seconds IS NULL OR elapsed_seconds >= 0),
  CONSTRAINT captains_table_challenges_remaining_check CHECK (remaining_seconds IS NULL OR remaining_seconds >= 0),
  CONSTRAINT captains_table_challenges_unique UNIQUE (table_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS public.captains_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  table_challenge_id uuid NOT NULL REFERENCES public.captains_table_challenges(id) ON DELETE CASCADE,
  captain_name text,
  evidence_type text NOT NULL,
  file_url text NOT NULL,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'uploaded',
  points_awarded integer NOT NULL DEFAULT 0,
  admin_comment text,
  elapsed_seconds integer,
  remaining_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  deleted_at timestamptz,
  CONSTRAINT captains_evidence_evidence_type_check CHECK (evidence_type IN ('photo', 'video', 'audio')),
  CONSTRAINT captains_evidence_status_check CHECK (status IN ('uploaded', 'pending_review', 'approved', 'rejected', 'deleted')),
  CONSTRAINT captains_evidence_points_check CHECK (points_awarded >= 0),
  CONSTRAINT captains_evidence_elapsed_check CHECK (elapsed_seconds IS NULL OR elapsed_seconds >= 0),
  CONSTRAINT captains_evidence_remaining_check CHECK (remaining_seconds IS NULL OR remaining_seconds >= 0)
);

CREATE INDEX IF NOT EXISTS captains_events_status_start_idx ON public.captains_events(status, start_time);
CREATE INDEX IF NOT EXISTS captains_events_slug_idx ON public.captains_events(slug);
CREATE INDEX IF NOT EXISTS captains_tables_event_points_idx ON public.captains_tables(event_id, total_points DESC, last_activity_at ASC);
CREATE INDEX IF NOT EXISTS captains_event_challenges_event_order_idx ON public.captains_event_challenges(event_id, order_index);
CREATE INDEX IF NOT EXISTS captains_table_challenges_table_order_idx ON public.captains_table_challenges(table_id, randomized_order_index);
CREATE INDEX IF NOT EXISTS captains_table_challenges_event_status_idx ON public.captains_table_challenges(event_id, status);
CREATE INDEX IF NOT EXISTS captains_evidence_event_status_idx ON public.captains_evidence(event_id, status);
CREATE INDEX IF NOT EXISTS captains_evidence_table_challenge_idx ON public.captains_evidence(table_challenge_id);

DROP TRIGGER IF EXISTS set_captains_events_updated_at ON public.captains_events;
CREATE TRIGGER set_captains_events_updated_at
  BEFORE UPDATE ON public.captains_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_captains_tables_updated_at ON public.captains_tables;
CREATE TRIGGER set_captains_tables_updated_at
  BEFORE UPDATE ON public.captains_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_captains_challenge_catalog_updated_at ON public.captains_challenge_catalog;
CREATE TRIGGER set_captains_challenge_catalog_updated_at
  BEFORE UPDATE ON public.captains_challenge_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_captains_event_challenges_updated_at ON public.captains_event_challenges;
CREATE TRIGGER set_captains_event_challenges_updated_at
  BEFORE UPDATE ON public.captains_event_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_captains_table_challenges_updated_at ON public.captains_table_challenges;
CREATE TRIGGER set_captains_table_challenges_updated_at
  BEFORE UPDATE ON public.captains_table_challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.captains_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains_challenge_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains_event_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains_table_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captains_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage captain events" ON public.captains_events;
CREATE POLICY "Authenticated users can manage captain events"
  ON public.captains_events FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read playable captain events" ON public.captains_events;
CREATE POLICY "Public can read playable captain events"
  ON public.captains_events FOR SELECT
  USING (status IN ('scheduled', 'active', 'finished'));

DROP POLICY IF EXISTS "Authenticated users can manage captain tables" ON public.captains_tables;
CREATE POLICY "Authenticated users can manage captain tables"
  ON public.captains_tables FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read captain tables for playable events" ON public.captains_tables;
CREATE POLICY "Public can read captain tables for playable events"
  ON public.captains_tables FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_tables.event_id
        AND captains_events.status IN ('scheduled', 'active', 'finished')
    )
  );

DROP POLICY IF EXISTS "Public can update captain table activity" ON public.captains_tables;
CREATE POLICY "Public can update captain table activity"
  ON public.captains_tables FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_tables.event_id
        AND captains_events.status IN ('scheduled', 'active')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_tables.event_id
        AND captains_events.status IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Challenge catalog is readable" ON public.captains_challenge_catalog;
CREATE POLICY "Challenge catalog is readable"
  ON public.captains_challenge_catalog FOR SELECT
  USING (is_active = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage challenge catalog" ON public.captains_challenge_catalog;
CREATE POLICY "Authenticated users can manage challenge catalog"
  ON public.captains_challenge_catalog FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can manage event challenges" ON public.captains_event_challenges;
CREATE POLICY "Authenticated users can manage event challenges"
  ON public.captains_event_challenges FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read captain event challenges" ON public.captains_event_challenges;
CREATE POLICY "Public can read captain event challenges"
  ON public.captains_event_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_event_challenges.event_id
        AND captains_events.status IN ('scheduled', 'active', 'finished')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage table challenges" ON public.captains_table_challenges;
CREATE POLICY "Authenticated users can manage table challenges"
  ON public.captains_table_challenges FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can read captain table challenges" ON public.captains_table_challenges;
CREATE POLICY "Public can read captain table challenges"
  ON public.captains_table_challenges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_table_challenges.event_id
        AND captains_events.status IN ('scheduled', 'active', 'finished')
    )
  );

DROP POLICY IF EXISTS "Public can update captain table challenge progress" ON public.captains_table_challenges;
CREATE POLICY "Public can update captain table challenge progress"
  ON public.captains_table_challenges FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_table_challenges.event_id
        AND captains_events.status IN ('scheduled', 'active')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_table_challenges.event_id
        AND captains_events.status IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can manage captain evidence" ON public.captains_evidence;
CREATE POLICY "Authenticated users can manage captain evidence"
  ON public.captains_evidence FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can upload captain evidence" ON public.captains_evidence;
CREATE POLICY "Public can upload captain evidence"
  ON public.captains_evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_evidence.event_id
        AND captains_events.status IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can read non-deleted captain evidence" ON public.captains_evidence;
CREATE POLICY "Public can read non-deleted captain evidence"
  ON public.captains_evidence FOR SELECT
  USING (
    status <> 'deleted'
    AND EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_evidence.event_id
        AND captains_events.status IN ('scheduled', 'active', 'finished')
    )
  );

INSERT INTO storage.buckets (id, name, "public")
VALUES ('captains-evidence', 'captains-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can upload captain evidence files" ON storage.objects;
CREATE POLICY "Public can upload captain evidence files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'captains-evidence');

DROP POLICY IF EXISTS "Authenticated users can read captain evidence files" ON storage.objects;
CREATE POLICY "Authenticated users can read captain evidence files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'captains-evidence' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update captain evidence files" ON storage.objects;
CREATE POLICY "Authenticated users can update captain evidence files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'captains-evidence' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'captains-evidence' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete captain evidence files" ON storage.objects;
CREATE POLICY "Authenticated users can delete captain evidence files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'captains-evidence' AND auth.role() = 'authenticated');

INSERT INTO public.captains_challenge_catalog (
  title,
  description,
  evidence_type,
  category,
  difficulty,
  default_points,
  has_time_limit,
  time_limit_seconds
) VALUES
  ('Brindis de mesa', 'Haced una foto de toda la mesa brindando por los novios.', 'photo', 'Mesa', 'easy', 10, false, NULL),
  ('Grito de guerra', 'Grabad un audio corto con el grito de guerra de vuestra mesa.', 'audio', 'Audio', 'medium', 15, true, 60),
  ('Foto con los novios', 'Conseguid una foto de alguien de la mesa con los novios.', 'photo', 'Novios', 'medium', 20, false, NULL),
  ('La mesa más elegante', 'Haced una foto presumiendo de modelazos.', 'photo', 'Foto grupal', 'easy', 10, false, NULL),
  ('Consejo matrimonial', 'Grabad un audio con un consejo para los novios.', 'audio', 'Emotivo', 'special', 20, true, 90),
  ('Foto en la pista', 'Haced una foto de alguien de la mesa dándolo todo en la pista de baile.', 'photo', 'Baile', 'medium', 15, false, NULL),
  ('Selfie imposible', 'Haced una selfie donde salga el mayor número posible de personas de la mesa.', 'photo', 'Divertido', 'easy', 10, true, 60),
  ('Mensaje secreto', 'Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.', 'video', 'Emotivo', 'special', 25, true, 120),
  ('Aliados de otra mesa', 'Haced una foto con alguien de otra mesa.', 'photo', 'Interacción', 'medium', 15, false, NULL),
  ('Momento película', 'Recread una escena dramática o divertida como si fuese una película.', 'video', 'Divertido', 'hard', 25, true, 120),
  ('La foto más bonita', 'Capturad un momento bonito de la boda desde vuestra mesa.', 'photo', 'Emotivo', 'medium', 15, false, NULL),
  ('Todos a una', 'Haced una foto de toda la mesa haciendo el mismo gesto.', 'photo', 'Mesa', 'easy', 10, true, 45),
  ('La canción de la mesa', 'Grabad un audio cantando un trozo de una canción dedicada a los novios.', 'audio', 'Audio', 'special', 20, true, 90),
  ('Foto de celebración', 'Haced una foto de la mesa celebrando como si hubiese ganado la Champions.', 'photo', 'Fiesta', 'medium', 15, true, 45),
  ('Declaración grupal', 'Grabad un vídeo corto diciendo algo bonito a los novios entre todos.', 'video', 'Emotivo', 'special', 25, true, 120)
ON CONFLICT (title) DO UPDATE SET
  description = EXCLUDED.description,
  evidence_type = EXCLUDED.evidence_type,
  category = EXCLUDED.category,
  difficulty = EXCLUDED.difficulty,
  default_points = EXCLUDED.default_points,
  has_time_limit = EXCLUDED.has_time_limit,
  time_limit_seconds = EXCLUDED.time_limit_seconds,
  is_active = true,
  updated_at = now();
