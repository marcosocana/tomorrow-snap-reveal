CREATE TABLE IF NOT EXISTS public.captains_creation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  redeemed_at timestamptz,
  event_id uuid REFERENCES public.captains_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS captains_creation_codes_code_idx
  ON public.captains_creation_codes(code);

ALTER TABLE public.captains_creation_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.captains_creation_codes FROM anon, authenticated;
GRANT ALL ON public.captains_creation_codes TO service_role;

