-- Drop RLS policies
DROP POLICY IF EXISTS "Referrer can read own rewards" ON public.referral_rewards;
DROP POLICY IF EXISTS "Referrer can read own attributions" ON public.referral_attributions;
DROP POLICY IF EXISTS "Owner can read own referral code" ON public.referral_codes;

-- Drop triggers
DROP TRIGGER IF EXISTS set_referral_codes_updated_at ON public.referral_codes;
DROP TRIGGER IF EXISTS set_referral_rewards_updated_at ON public.referral_rewards;

-- Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS public.referral_rewards CASCADE;
DROP TABLE IF EXISTS public.referral_attributions CASCADE;
DROP TABLE IF EXISTS public.referral_codes CASCADE;