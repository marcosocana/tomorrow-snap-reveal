-- User profiles tied to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Extend events with ownership and plan metadata
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'demo',
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS limits_json jsonb DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_type_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_type_check CHECK (type IN ('demo', 'paid'));
  END IF;
END $$;

-- Purchases / redeem tokens for paid plans
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  stripe_session_id text UNIQUE NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'paid', -- paid | redeemed | expired
  redeem_token text UNIQUE NOT NULL,
  redeem_token_expires_at timestamp with time zone,
  redeemed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Profiles: owners can read/write their own
CREATE POLICY IF NOT EXISTS "Profiles are viewable by owner"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Profiles are insertable by owner"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Profiles are updatable by owner"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Purchases: only owner can read (writes via service role)
CREATE POLICY IF NOT EXISTS "Purchases are viewable by owner"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Events: allow authenticated owners to write
DROP POLICY IF EXISTS "Anyone can create events" ON public.events;
CREATE POLICY "Owners can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY IF NOT EXISTS "Owners can update events"
  ON public.events FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY IF NOT EXISTS "Owners can delete events"
  ON public.events FOR DELETE
  USING (auth.uid() = owner_id);
