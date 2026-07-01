GRANT INSERT ON public.captains_evidence TO anon, authenticated;

DROP POLICY IF EXISTS "Public can insert evidence of active events" ON public.captains_evidence;
DROP POLICY IF EXISTS "Public can insert evidence of playable captain events" ON public.captains_evidence;

CREATE POLICY "Public can insert evidence of playable captain events"
  ON public.captains_evidence
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    evidence_type IN ('photo', 'video')
    AND file_url IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.captains_events e
      JOIN public.captains_tables t ON t.event_id = e.id
      JOIN public.captains_table_challenges tc ON tc.table_id = t.id
      WHERE e.id = captains_evidence.event_id
        AND t.id = captains_evidence.table_id
        AND tc.id = captains_evidence.table_challenge_id
        AND tc.event_id = e.id
        AND tc.challenge_id IS NOT NULL
    )
  );

NOTIFY pgrst, 'reload schema';
