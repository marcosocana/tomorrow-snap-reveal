CREATE OR REPLACE FUNCTION public.enforce_captains_event_challenge_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.captains_event_challenges
    WHERE event_id = NEW.event_id
      AND (TG_OP <> 'UPDATE' OR id <> NEW.id)
  ) >= 25 THEN
    RAISE EXCEPTION 'A Captains event cannot contain more than 25 challenges.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS captains_event_challenge_limit ON public.captains_event_challenges;

CREATE TRIGGER captains_event_challenge_limit
BEFORE INSERT OR UPDATE OF event_id ON public.captains_event_challenges
FOR EACH ROW
EXECUTE FUNCTION public.enforce_captains_event_challenge_limit();

CREATE OR REPLACE FUNCTION public.prevent_captains_completion_after_end()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  event_end timestamptz;
  event_status text;
BEGIN
  SELECT end_time, status
  INTO event_end, event_status
  FROM public.captains_events
  WHERE id = NEW.event_id;

  IF (event_status = 'finished' OR (event_end IS NOT NULL AND now() >= event_end)) THEN
    IF TG_TABLE_NAME = 'captains_evidence' OR NEW.status IN ('in_progress', 'submitted', 'completed', 'pending_review', 'failed') THEN
      RAISE EXCEPTION 'This Captains event has ended and no longer accepts challenge completions.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS captains_evidence_close_at_event_end ON public.captains_evidence;
CREATE TRIGGER captains_evidence_close_at_event_end
BEFORE INSERT ON public.captains_evidence
FOR EACH ROW
EXECUTE FUNCTION public.prevent_captains_completion_after_end();

DROP TRIGGER IF EXISTS captains_challenge_close_at_event_end ON public.captains_table_challenges;
CREATE TRIGGER captains_challenge_close_at_event_end
BEFORE INSERT OR UPDATE OF status ON public.captains_table_challenges
FOR EACH ROW
EXECUTE FUNCTION public.prevent_captains_completion_after_end();
