ALTER TABLE public.captains_events
  ADD COLUMN IF NOT EXISTS admin_event_tab text,
  ADD COLUMN IF NOT EXISTS deletion_lock_pin text;

ALTER TABLE public.captains_events
  DROP CONSTRAINT IF EXISTS captains_events_admin_event_tab_check;

ALTER TABLE public.captains_events
  ADD CONSTRAINT captains_events_admin_event_tab_check
  CHECK (admin_event_tab IS NULL OR admin_event_tab IN ('new', 'upcoming', 'past', 'tests'));

COMMENT ON COLUMN public.captains_events.admin_event_tab IS
  'Optional manual organization tab used by the Revelao superadmin.';

COMMENT ON COLUMN public.captains_events.deletion_lock_pin IS
  'Superadmin PIN required by the management UI before deleting the event.';

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.enforce_time_capsule_message_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  capsule_event public.events%ROWTYPE;
  current_messages integer;
BEGIN
  SELECT * INTO capsule_event FROM public.events WHERE id = NEW.event_id;
  IF NOT FOUND OR NOT (
    COALESCE(capsule_event.plan_id = 'capsule', false)
    OR COALESCE(capsule_event.type = 'capsule', false)
  ) OR COALESCE(capsule_event.max_videos, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.event_id::text, 0));
  SELECT count(*) INTO current_messages FROM public.videos WHERE event_id = NEW.event_id;
  IF current_messages >= capsule_event.max_videos THEN
    RAISE EXCEPTION 'TIME_CAPSULE_MESSAGE_LIMIT_REACHED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_time_capsule_message_limit_before_insert ON public.videos;
CREATE TRIGGER enforce_time_capsule_message_limit_before_insert
  BEFORE INSERT ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_time_capsule_message_limit();
