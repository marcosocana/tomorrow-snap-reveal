CREATE OR REPLACE FUNCTION public.can_manage_revelao_event(
  target_event_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = target_event_id
        AND (
          e.owner_id = auth.uid()
          OR lower(coalesce(auth.jwt() ->> 'email', ''))
             = 'revelao.cam@gmail.com'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_revelao_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_revelao_event(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Managers can view event videos" ON public.videos;
CREATE POLICY "Managers can view event videos"
ON public.videos
FOR SELECT
TO authenticated
USING (public.can_manage_revelao_event(event_id));

DROP POLICY IF EXISTS "Managers can view event audios" ON public.audios;
CREATE POLICY "Managers can view event audios"
ON public.audios
FOR SELECT
TO authenticated
USING (public.can_manage_revelao_event(event_id));

DROP POLICY IF EXISTS "Managers can view event video objects" ON storage.objects;
CREATE POLICY "Managers can view event video objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-videos'
  AND EXISTS (
    SELECT 1
    FROM public.videos v
    WHERE v.video_url = storage.objects.name
      AND public.can_manage_revelao_event(v.event_id)
  )
);

DROP POLICY IF EXISTS "Managers can view event audio objects" ON storage.objects;
CREATE POLICY "Managers can view event audio objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-audios'
  AND EXISTS (
    SELECT 1
    FROM public.audios a
    WHERE a.audio_url = storage.objects.name
      AND public.can_manage_revelao_event(a.event_id)
  )
);