-- Add columns for photo deletion permission and legal text visibility
ALTER TABLE public.events 
ADD COLUMN allow_photo_deletion boolean NOT NULL DEFAULT true,
ADD COLUMN show_legal_text boolean NOT NULL DEFAULT false;