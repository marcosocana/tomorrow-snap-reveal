-- Fix: allow anonymous/public inserts on captains_evidence for scheduled/active events

GRANT SELECT, INSERT ON public.captains_evidence TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.captains_evidence TO authenticated;
GRANT ALL ON public.captains_evidence TO service_role;

DROP POLICY IF EXISTS "Public can insert evidence of active events" ON public.captains_evidence;

CREATE POLICY "Public can insert evidence of active events"
ON public.captains_evidence
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.captains_events e
    WHERE e.id = captains_evidence.event_id
      AND public.captains_event_status(e.start_time, e.end_time) IN ('scheduled','active')
  )
);

NOTIFY pgrst, 'reload schema';