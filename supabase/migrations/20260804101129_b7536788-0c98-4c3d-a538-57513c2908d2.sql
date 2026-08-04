ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS gifted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS gift_recipient_name text NULL;

COMMENT ON COLUMN public.purchases.gifted_at IS 'Timestamp when this purchase was created as a gift by an admin';
COMMENT ON COLUMN public.purchases.gift_recipient_name IS 'Name of the gift recipient';

CREATE INDEX IF NOT EXISTS purchases_redeem_token_idx ON public.purchases (redeem_token);

NOTIFY pgrst, 'reload schema';