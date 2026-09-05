-- Repair v2 events that were edited after creation. The former purchase-link
-- update flow saved new tables/challenges without creating their progress rows.
WITH missing AS (
  SELECT
    event.id AS event_id,
    captain_table.id AS table_id,
    challenge.id AS challenge_id,
    COALESCE(existing.max_order, 0)
      + ROW_NUMBER() OVER (
          PARTITION BY captain_table.id
          ORDER BY challenge.order_index, challenge.created_at, challenge.id
        ) AS randomized_order_index
  FROM public.captains_events event
  JOIN public.captains_tables captain_table ON captain_table.event_id = event.id
  JOIN public.captains_event_challenges challenge ON challenge.event_id = event.id
  LEFT JOIN LATERAL (
    SELECT MAX(progress.randomized_order_index) AS max_order
    FROM public.captains_table_challenges progress
    WHERE progress.table_id = captain_table.id
  ) existing ON true
  WHERE event.experience_version = 'v2'
    AND NOT EXISTS (
      SELECT 1
      FROM public.captains_table_challenges progress
      WHERE progress.table_id = captain_table.id
        AND progress.challenge_id = challenge.id
    )
)
INSERT INTO public.captains_table_challenges (
  event_id,
  table_id,
  challenge_id,
  randomized_order_index,
  status
)
SELECT event_id, table_id, challenge_id, randomized_order_index, 'pending'
FROM missing
ON CONFLICT (table_id, challenge_id) DO NOTHING;

-- Ensure each unfinished table has one actionable challenge. This also repairs
-- rows created by older versions where every challenge was left pending.
WITH candidates AS (
  SELECT DISTINCT ON (progress.table_id) progress.id
  FROM public.captains_table_challenges progress
  JOIN public.captains_events event ON event.id = progress.event_id
  WHERE event.experience_version = 'v2'
    AND progress.status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM public.captains_table_challenges playable
      WHERE playable.table_id = progress.table_id
        AND playable.status IN ('ready', 'in_progress', 'pending_review')
    )
  ORDER BY progress.table_id, progress.randomized_order_index, progress.created_at, progress.id
)
UPDATE public.captains_table_challenges progress
SET status = 'ready', updated_at = now()
FROM candidates
WHERE progress.id = candidates.id;

NOTIFY pgrst, 'reload schema';
