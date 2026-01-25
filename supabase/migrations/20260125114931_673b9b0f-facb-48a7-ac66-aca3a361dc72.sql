-- Create table for event folders
CREATE TABLE public.event_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Override settings (when set, these override individual event settings)
  custom_image_url text,
  background_image_url text,
  font_family text,
  font_size text
);

-- Enable RLS
ALTER TABLE public.event_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for folders (same as events - anyone authenticated can manage)
CREATE POLICY "Anyone can read folders" ON public.event_folders FOR SELECT USING (true);
CREATE POLICY "Anyone can create folders" ON public.event_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update folders" ON public.event_folders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete folders" ON public.event_folders FOR DELETE USING (true);

-- Add folder_id to events table
ALTER TABLE public.events ADD COLUMN folder_id uuid REFERENCES public.event_folders(id) ON DELETE SET NULL;