-- Enable gallery attachments for events created from now on. Changing the
-- column defaults does not modify any existing event rows.
ALTER TABLE public.events
  ALTER COLUMN allow_image_attachment SET DEFAULT true,
  ALTER COLUMN allow_video_attachment SET DEFAULT true;
