
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS legal_text_type text NOT NULL DEFAULT 'default';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS custom_terms_text text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS custom_privacy_text text;
