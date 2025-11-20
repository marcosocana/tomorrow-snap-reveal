-- Create storage policies for event-photos bucket

-- Allow anyone to view photos (for signed URLs)
CREATE POLICY "Anyone can view event photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-photos');

-- Allow anyone to upload photos to events
CREATE POLICY "Anyone can upload event photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-photos');