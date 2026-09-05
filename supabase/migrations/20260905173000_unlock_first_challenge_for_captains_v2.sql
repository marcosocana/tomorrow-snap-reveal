WITH first_pending AS (
  SELECT DISTINCT ON (progress.table_id) progress.id
  FROM public.captains_table_challenges progress
  JOIN public.captains_events event ON event.id = progress.event_id
  WHERE event.experience_version = 'v2'
    AND progress.status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM public.captains_table_challenges open_progress
      WHERE open_progress.table_id = progress.table_id
        AND open_progress.status IN ('ready', 'in_progress', 'submitted', 'pending_review')
    )
  ORDER BY progress.table_id, progress.randomized_order_index, progress.created_at
)
UPDATE public.captains_table_challenges progress
SET status = 'ready', updated_at = now()
FROM first_pending
WHERE progress.id = first_pending.id;

NOTIFY pgrst, 'reload schema';
