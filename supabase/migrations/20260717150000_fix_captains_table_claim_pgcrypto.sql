-- Supabase installs pgcrypto in the extensions schema. The claim RPC is a
-- SECURITY DEFINER function with an explicit search_path, so that schema must
-- be included for digest() to resolve when a player reserves a table.
ALTER FUNCTION public.claim_captains_table(uuid, text, uuid, text, jsonb)
  SET search_path = public, extensions, pg_temp;

NOTIFY pgrst, 'reload schema';
