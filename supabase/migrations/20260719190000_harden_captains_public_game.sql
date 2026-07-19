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

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON
  public.captains_events,
  public.captains_tables,
  public.captains_event_challenges,
  public.captains_table_challenges,
  public.captains_evidence
TO anon;

GRANT UPDATE (
  captain_name,
  active_captain_name,
  last_activity_at,
  updated_at,
  total_points,
  completed_challenges,
  failed_challenges,
  current_challenge_id,
  completed_at,
  captain_photo_url,
  captain_sprite,
  captain_sprite_config,
  session_token
) ON public.captains_tables TO anon;

GRANT INSERT ON public.captains_table_accesses TO anon;
GRANT INSERT ON public.captains_table_challenges TO anon;
GRANT UPDATE (
  status,
  points_awarded,
  started_at,
  submitted_at,
  reviewed_at,
  elapsed_seconds,
  remaining_seconds,
  question_answer,
  is_time_expired,
  automatic_score_calculated,
  updated_at
) ON public.captains_table_challenges TO anon;
GRANT INSERT ON public.captains_evidence TO anon;

DROP POLICY IF EXISTS "Public can update tables of scheduled/active events" ON public.captains_tables;
DROP POLICY IF EXISTS "Public can update captain table activity" ON public.captains_tables;
CREATE POLICY "Public can update active captains tables"
  ON public.captains_tables
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      WHERE event.id = captains_tables.event_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      WHERE event.id = captains_tables.event_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can insert table challenges of active events" ON public.captains_table_challenges;
DROP POLICY IF EXISTS "Public can insert captain table challenge progress" ON public.captains_table_challenges;
CREATE POLICY "Public can insert active captains progress"
  ON public.captains_table_challenges
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      JOIN public.captains_tables captain_table ON captain_table.event_id = event.id
      JOIN public.captains_event_challenges challenge ON challenge.event_id = event.id
      WHERE event.id = captains_table_challenges.event_id
        AND captain_table.id = captains_table_challenges.table_id
        AND challenge.id = captains_table_challenges.challenge_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can update table challenges of active events" ON public.captains_table_challenges;
DROP POLICY IF EXISTS "Public can update captain table challenge progress" ON public.captains_table_challenges;
CREATE POLICY "Public can update active captains progress"
  ON public.captains_table_challenges
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      WHERE event.id = captains_table_challenges.event_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      JOIN public.captains_tables captain_table ON captain_table.event_id = event.id
      JOIN public.captains_event_challenges challenge ON challenge.event_id = event.id
      WHERE event.id = captains_table_challenges.event_id
        AND captain_table.id = captains_table_challenges.table_id
        AND challenge.id = captains_table_challenges.challenge_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can insert table accesses" ON public.captains_table_accesses;
DROP POLICY IF EXISTS "Public can register captain table accesses" ON public.captains_table_accesses;
CREATE POLICY "Public can register active captains access"
  ON public.captains_table_accesses
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.captains_events event
      JOIN public.captains_tables captain_table ON captain_table.event_id = event.id
      WHERE event.id = captains_table_accesses.event_id
        AND captain_table.id = captains_table_accesses.table_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can insert evidence of active events" ON public.captains_evidence;
DROP POLICY IF EXISTS "Public can insert evidence of playable captain events" ON public.captains_evidence;
DROP POLICY IF EXISTS "Public can upload captain evidence" ON public.captains_evidence;
CREATE POLICY "Public can insert active captains evidence"
  ON public.captains_evidence
  FOR INSERT
  TO anon
  WITH CHECK (
    evidence_type IN ('photo', 'video')
    AND NULLIF(file_url, '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.captains_events event
      JOIN public.captains_tables captain_table ON captain_table.event_id = event.id
      JOIN public.captains_table_challenges progress
        ON progress.event_id = event.id
       AND progress.table_id = captain_table.id
      WHERE event.id = captains_evidence.event_id
        AND captain_table.id = captains_evidence.table_id
        AND progress.id = captains_evidence.table_challenge_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can upload captain evidence files" ON storage.objects;
CREATE POLICY "Public can upload active captain evidence files"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'captains-evidence'
    AND EXISTS (
      SELECT 1
      FROM public.captains_events event
      WHERE event.id::text = split_part(name, '/', 1)
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled', 'active')
    )
  );

NOTIFY pgrst, 'reload schema';
