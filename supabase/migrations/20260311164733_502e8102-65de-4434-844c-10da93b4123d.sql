
-- 1. referral_codes
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_user_id_key UNIQUE (user_id),
  CONSTRAINT referral_codes_code_key UNIQUE (code)
);

-- 2. referral_attributions
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  referred_email text,
  source text DEFAULT 'demo_signup',
  demo_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  converted_at timestamptz,
  purchase_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_attributions_referred_user_id_key UNIQUE (referred_user_id)
);

-- 3. referral_rewards
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  attribution_id uuid REFERENCES public.referral_attributions(id),
  purchase_id uuid,
  amount_eur numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_rewards_purchase_id_key UNIQUE (purchase_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_referrer ON public.referral_attributions(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_attributions_referred ON public.referral_attributions(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards(referrer_user_id);

-- Trigger updated_at for referral_codes
CREATE TRIGGER set_referral_codes_updated_at
  BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Trigger updated_at for referral_rewards
CREATE TRIGGER set_referral_rewards_updated_at
  BEFORE UPDATE ON public.referral_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Policies: referral_codes - owner can read
CREATE POLICY "Owner can read own referral code"
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policies: referral_attributions - referrer can read
CREATE POLICY "Referrer can read own attributions"
  ON public.referral_attributions FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid());

-- Policies: referral_rewards - referrer can read
CREATE POLICY "Referrer can read own rewards"
  ON public.referral_rewards FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid());
