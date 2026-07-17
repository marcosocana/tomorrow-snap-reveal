ALTER FUNCTION public.claim_captains_table(uuid, text, uuid, text, jsonb) SET search_path = public, extensions, pg_temp;
NOTIFY pgrst, 'reload schema';