-- Authenticated customers may only manage their own Capitanes events. The
-- Revelao super-admin keeps access to every event.
CREATE OR REPLACE FUNCTION public.is_revelao_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'revelao.cam@gmail.com';
$$;

GRANT EXECUTE ON FUNCTION public.is_revelao_super_admin() TO authenticated, service_role;

-- Gameplay mutation policies are intentionally anonymous. Limiting their role
-- prevents an authenticated customer from using those public policies to
-- modify another customer's event.
ALTER POLICY "Public can update active captains tables" ON public.captains_tables TO anon;
ALTER POLICY "Public can insert active captains progress" ON public.captains_table_challenges TO anon;
ALTER POLICY "Public can update active captains progress" ON public.captains_table_challenges TO anon;
ALTER POLICY "Public can register active captains access" ON public.captains_table_accesses TO anon;
ALTER POLICY "Public can insert active captains evidence" ON public.captains_evidence TO anon;

DROP POLICY IF EXISTS "Authenticated can manage captains events" ON public.captains_events;
CREATE POLICY "Owners can manage captains events" ON public.captains_events
  TO authenticated
  USING (owner_id = auth.uid() OR public.is_revelao_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_revelao_super_admin());

DROP POLICY IF EXISTS "Authenticated can manage captains tables" ON public.captains_tables;
CREATE POLICY "Owners can manage captains tables" ON public.captains_tables
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_tables.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_tables.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ));

DROP POLICY IF EXISTS "Authenticated can manage event challenges" ON public.captains_event_challenges;
CREATE POLICY "Owners can manage captains event challenges" ON public.captains_event_challenges
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_event_challenges.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_event_challenges.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ));

DROP POLICY IF EXISTS "Authenticated can manage table challenges" ON public.captains_table_challenges;
CREATE POLICY "Owners can manage captains table challenges" ON public.captains_table_challenges
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_table_challenges.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_table_challenges.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ));

DROP POLICY IF EXISTS "Authenticated can manage evidence" ON public.captains_evidence;
CREATE POLICY "Owners can manage captains evidence" ON public.captains_evidence
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_evidence.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_evidence.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ));

DROP POLICY IF EXISTS "Authenticated can manage table accesses" ON public.captains_table_accesses;
CREATE POLICY "Owners can manage captains table accesses" ON public.captains_table_accesses
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_table_accesses.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.captains_events event
    WHERE event.id = captains_table_accesses.event_id
      AND (event.owner_id = auth.uid() OR public.is_revelao_super_admin())
  ));
