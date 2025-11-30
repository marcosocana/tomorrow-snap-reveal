-- Make event-photos bucket public so custom event images are visible
UPDATE storage.buckets 
SET public = true 
WHERE id = 'event-photos';