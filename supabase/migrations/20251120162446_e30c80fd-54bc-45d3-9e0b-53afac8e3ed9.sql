-- Allow deletion of events
CREATE POLICY "Anyone can delete events"
ON public.events
FOR DELETE
USING (true);