-- Restore the original shared-table flow. The public UI no longer calls the
-- exclusive claim RPC, and any participant may select the same table.
GRANT UPDATE (
  captain_name,
  active_captain_name,
  last_activity_at,
  updated_at
) ON public.captains_tables TO anon;

GRANT INSERT ON public.captains_table_accesses TO anon;

NOTIFY pgrst, 'reload schema';
