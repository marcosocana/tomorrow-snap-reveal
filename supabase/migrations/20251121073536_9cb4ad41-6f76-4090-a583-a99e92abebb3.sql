-- Create table for photo likes
CREATE TABLE public.photo_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read likes (to calculate popularity)
CREATE POLICY "Anyone can read photo likes"
ON public.photo_likes
FOR SELECT
USING (true);

-- Allow anyone to add likes (anonymous)
CREATE POLICY "Anyone can add likes"
ON public.photo_likes
FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_photo_likes_photo_id ON public.photo_likes(photo_id);