-- Add admin password field to events table
ALTER TABLE public.events 
ADD COLUMN admin_password TEXT;

-- Add policy to allow anyone to update events (needed for admin panel)
CREATE POLICY "Anyone can update events"
ON public.events
FOR UPDATE
USING (true)
WITH CHECK (true);