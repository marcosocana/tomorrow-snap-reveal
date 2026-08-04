ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS gifted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS gift_recipient_name text;

COMMENT ON COLUMN public.purchases.gifted_at IS
  'Marks redeem purchases created as gifts by the Revelao administrator.';

COMMENT ON COLUMN public.purchases.gift_recipient_name IS
  'Recipient display name used in the gift email.';
