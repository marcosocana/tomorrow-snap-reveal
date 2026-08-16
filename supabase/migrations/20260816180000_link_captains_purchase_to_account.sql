ALTER TABLE public.captains_creation_codes
  ADD COLUMN IF NOT EXISTS account_owner_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS captains_creation_codes_account_owner_idx
  ON public.captains_creation_codes (account_owner_id)
  WHERE account_owner_id IS NOT NULL;

COMMENT ON COLUMN public.captains_creation_codes.account_owner_id IS
  'Account that paid for this Capitanes creation code. Unlike created_by, this account owns the resulting event.';
