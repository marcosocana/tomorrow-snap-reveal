-- Add expiry date and redirect URL columns to events table
ALTER TABLE public.events 
ADD COLUMN expiry_date timestamp with time zone DEFAULT NULL,
ADD COLUMN expiry_redirect_url text DEFAULT NULL;