-- Add RLS policy to allow anyone to delete photos
CREATE POLICY "Anyone can delete photos"
ON photos
FOR DELETE
USING (true);