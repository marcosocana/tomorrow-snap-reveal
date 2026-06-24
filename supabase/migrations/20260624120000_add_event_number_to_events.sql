CREATE SEQUENCE IF NOT EXISTS public.events_event_number_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_number integer;

WITH numbered_events AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at ASC, id ASC)::integer AS event_number
  FROM public.events
  WHERE event_number IS NULL
)
UPDATE public.events AS events
SET event_number = numbered_events.event_number
FROM numbered_events
WHERE events.id = numbered_events.id;

SELECT setval(
  'public.events_event_number_seq',
  GREATEST(COALESCE((SELECT max(event_number) FROM public.events), 0) + 1, 1),
  false
);

ALTER TABLE public.events
  ALTER COLUMN event_number SET DEFAULT nextval('public.events_event_number_seq'::regclass),
  ALTER COLUMN event_number SET NOT NULL;

ALTER SEQUENCE public.events_event_number_seq
  OWNED BY public.events.event_number;

CREATE UNIQUE INDEX IF NOT EXISTS events_event_number_key
  ON public.events(event_number);
