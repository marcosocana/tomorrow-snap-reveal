-- Add policy to allow reading all photos (for admin mode)
-- This will work alongside the time-based policy
DROP POLICY IF EXISTS "Anyone can read all photos" ON photos;

CREATE POLICY "Anyone can read all photos" 
ON photos 
FOR SELECT 
USING (true);