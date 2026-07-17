CREATE OR REPLACE FUNCTION public.get_admin_database_usage()
RETURNS TABLE (
  database_bytes bigint,
  database_pretty text,
  measured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF lower(COALESCE(auth.jwt() ->> 'email', '')) <> 'revelao.cam@gmail.com' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ADMIN_ONLY';
  END IF;

  RETURN QUERY
  SELECT
    pg_database_size(current_database()),
    pg_size_pretty(pg_database_size(current_database())),
    clock_timestamp();
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_database_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_database_usage() TO authenticated;

NOTIFY pgrst, 'reload schema';
