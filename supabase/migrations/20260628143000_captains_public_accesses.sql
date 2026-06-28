CREATE TABLE IF NOT EXISTS public.captains_table_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.captains_events(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.captains_tables(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  captain_name text NOT NULL,
  session_token text NOT NULL,
  selected_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  device_info jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS captains_table_accesses_event_table_idx
  ON public.captains_table_accesses(event_id, table_id, selected_at DESC);

ALTER TABLE public.captains_table_accesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read captain table accesses" ON public.captains_table_accesses;
CREATE POLICY "Authenticated users can read captain table accesses"
  ON public.captains_table_accesses FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can register captain table accesses" ON public.captains_table_accesses;
CREATE POLICY "Public can register captain table accesses"
  ON public.captains_table_accesses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.captains_events
      WHERE captains_events.id = captains_table_accesses.event_id
        AND captains_events.status IN ('scheduled', 'active')
    )
  );

DROP POLICY IF EXISTS "Public can read captain evidence files" ON storage.objects;
CREATE POLICY "Public can read captain evidence files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'captains-evidence');
