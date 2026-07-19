GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT ON
  public.captains_events,
  public.captains_tables,
  public.captains_event_challenges,
  public.captains_table_challenges
TO anon;

GRANT UPDATE (
  captain_name,
  active_captain_name,
  last_activity_at,
  updated_at,
  total_points,
  completed_challenges,
  failed_challenges,
  current_challenge_id,
  completed_at,
  captain_photo_url,
  captain_sprite,
  captain_sprite_config,
  session_token
) ON public.captains_tables TO anon;

GRANT INSERT ON public.captains_table_accesses TO anon;
GRANT INSERT ON public.captains_table_challenges TO anon;

GRANT UPDATE (
  status,
  points_awarded,
  started_at,
  submitted_at,
  reviewed_at,
  elapsed_seconds,
  remaining_seconds,
  is_time_expired,
  automatic_score_calculated,
  updated_at
) ON public.captains_table_challenges TO anon;

GRANT INSERT ON public.captains_evidence TO anon;

NOTIFY pgrst, 'reload schema';
