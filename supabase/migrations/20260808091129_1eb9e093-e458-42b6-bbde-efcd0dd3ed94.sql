ALTER TABLE public.events
  ALTER COLUMN allow_image_attachment SET DEFAULT true,
  ALTER COLUMN allow_video_attachment SET DEFAULT true;