-- Add sort_order column to events table for manual ordering within folders
ALTER TABLE public.events ADD COLUMN sort_order integer DEFAULT 0;

-- Initialize sort_order based on current created_at order within each folder
WITH ordered_events AS (
  SELECT id, folder_id, ROW_NUMBER() OVER (PARTITION BY folder_id ORDER BY created_at ASC) as rn
  FROM public.events
  WHERE folder_id IS NOT NULL
)
UPDATE public.events e
SET sort_order = oe.rn
FROM ordered_events oe
WHERE e.id = oe.id;