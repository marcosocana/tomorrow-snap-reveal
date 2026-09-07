ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS wedding_context jsonb,
  ADD COLUMN IF NOT EXISTS character_1_config jsonb,
  ADD COLUMN IF NOT EXISTS character_2_config jsonb,
  ADD COLUMN IF NOT EXISTS host_characters_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS host_tone text NOT NULL DEFAULT 'divertido',
  ADD COLUMN IF NOT EXISTS host_frequency text NOT NULL DEFAULT 'normal';

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_host_tone_check,
  ADD CONSTRAINT captains_events_host_tone_check CHECK (host_tone IN ('divertido','elegante','gamberro','epico','romantico')),
  DROP CONSTRAINT IF EXISTS captains_events_host_frequency_check,
  ADD CONSTRAINT captains_events_host_frequency_check CHECK (host_frequency IN ('low','normal','high'));

CREATE TABLE IF NOT EXISTS public.captains_host_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  intervention_type text NOT NULL DEFAULT 'host_message',
  trigger text NOT NULL,
  variant integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  shown_at timestamptz,
  dismissed_at timestamptz,
  CONSTRAINT captains_host_interventions_status_check CHECK (status IN ('pending','shown','dismissed')),
  CONSTRAINT captains_host_interventions_once UNIQUE (event_id, table_id, trigger)
);

CREATE INDEX IF NOT EXISTS captains_host_interventions_team_created_idx
  ON public.captains_host_interventions(table_id, created_at DESC);

ALTER TABLE public.captains_host_interventions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.captains_host_interventions TO anon;
GRANT UPDATE(status, shown_at, dismissed_at) ON public.captains_host_interventions TO anon;
GRANT ALL ON public.captains_host_interventions TO authenticated;
GRANT ALL ON public.captains_host_interventions TO service_role;

CREATE POLICY "Owners can manage captains host interventions"
  ON public.captains_host_interventions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.captains_events event WHERE event.id = captains_host_interventions.event_id AND event.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.captains_events event WHERE event.id = captains_host_interventions.event_id AND event.owner_id = auth.uid()));

CREATE POLICY "Public can read captains host interventions"
  ON public.captains_host_interventions FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.captains_events event WHERE event.id = captains_host_interventions.event_id AND event.status IN ('scheduled','active','finished')));

CREATE POLICY "Public can create captains host interventions"
  ON public.captains_host_interventions FOR INSERT TO anon
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.captains_events event
      JOIN public.captains_tables team ON team.event_id = event.id
      WHERE event.id = captains_host_interventions.event_id AND team.id = captains_host_interventions.table_id
        AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled','active')
    )
  );

CREATE POLICY "Public can acknowledge captains host interventions"
  ON public.captains_host_interventions FOR UPDATE TO anon
  USING (EXISTS (SELECT 1 FROM public.captains_events event WHERE event.id = captains_host_interventions.event_id AND public.captains_event_status(event.start_time, event.end_time) IN ('scheduled','active')))
  WITH CHECK (status IN ('shown','dismissed'));

COMMENT ON COLUMN public.captains_events.host_characters_enabled IS 'Disabled for existing events; the application enables it for newly created v2 events.';
NOTIFY pgrst, 'reload schema';