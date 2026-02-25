
-- 1. Create blog_posts table
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text NOT NULL CHECK (lang IN ('es', 'en', 'it')),
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL,
  content_html text NOT NULL,
  image_url text NOT NULL,
  tags jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Unique index on (lang, slug)
CREATE UNIQUE INDEX blog_posts_lang_slug_idx ON public.blog_posts (lang, slug);

-- 3. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 5. Public read policy
CREATE POLICY "Public can read blog posts"
  ON public.blog_posts
  FOR SELECT
  USING (true);

-- 6. Storage bucket for blog images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true);

-- 7. Public read policy for blog-images bucket
CREATE POLICY "Public can read blog images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'blog-images');

-- 8. Authenticated users can upload blog images
CREATE POLICY "Authenticated can upload blog images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'blog-images' AND auth.role() = 'authenticated');

-- 9. Authenticated can delete blog images
CREATE POLICY "Authenticated can delete blog images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'blog-images' AND auth.role() = 'authenticated');
