CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_format_check CHECK (code ~ '^[A-Z0-9]{6,20}$')
);

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text,
  source text NOT NULL DEFAULT 'demo_signup',
  demo_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  converted_at timestamp with time zone,
  purchase_id uuid UNIQUE REFERENCES public.purchases(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  attribution_id uuid NOT NULL UNIQUE REFERENCES public.referral_attributions(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL UNIQUE REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount_eur numeric(10,2) NOT NULL DEFAULT 30.00,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT referral_rewards_status_check CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id
  ON public.referral_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code
  ON public.referral_codes(code);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer_user_id
  ON public.referral_attributions(referrer_user_id);

CREATE INDEX IF NOT EXISTS idx_referral_attributions_referred_user_id
  ON public.referral_attributions(referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer_user_id
  ON public.referral_rewards(referrer_user_id);

DROP TRIGGER IF EXISTS set_referral_codes_updated_at ON public.referral_codes;
CREATE TRIGGER set_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Referral codes are viewable by owner"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Referral attributions are viewable by referrer"
  ON public.referral_attributions FOR SELECT
  USING (auth.uid() = referrer_user_id);

CREATE POLICY IF NOT EXISTS "Referral rewards are viewable by referrer"
  ON public.referral_rewards FOR SELECT
  USING (auth.uid() = referrer_user_id);
