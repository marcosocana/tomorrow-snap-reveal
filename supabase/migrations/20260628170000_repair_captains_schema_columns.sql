CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.captains_events
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS start_time timestamptz,
ADD COLUMN IF NOT EXISTS end_time timestamptz,
ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS show_live_gallery_after_completion boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS qr_url text,
ADD COLUMN IF NOT EXISTS public_url text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.captains_challenge_catalog
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS evidence_type text NOT NULL DEFAULT 'photo',
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'easy',
ADD COLUMN IF NOT EXISTS default_points integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS has_time_limit boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS time_limit_seconds integer,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.captains_event_challenges
ADD COLUMN IF NOT EXISTS catalog_challenge_id uuid REFERENCES public.captains_challenge_catalog(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS evidence_type text NOT NULL DEFAULT 'photo',
ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'easy',
ADD COLUMN IF NOT EXISTS has_time_limit boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS time_limit_seconds integer,
ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.captains_tables
ADD COLUMN IF NOT EXISTS table_name text,
ADD COLUMN IF NOT EXISTS captain_name text,
ADD COLUMN IF NOT EXISTS active_captain_name text,
ADD COLUMN IF NOT EXISTS session_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
ADD COLUMN IF NOT EXISTS total_points integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_challenges integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_challenges integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_challenge_id uuid REFERENCES public.captains_event_challenges(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.captains_table_challenges
ADD COLUMN IF NOT EXISTS randomized_order_index integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS points_awarded integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS elapsed_seconds integer,
ADD COLUMN IF NOT EXISTS remaining_seconds integer,
ADD COLUMN IF NOT EXISTS is_time_expired boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS automatic_score_calculated boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.captains_evidence
ADD COLUMN IF NOT EXISTS captain_name text,
ADD COLUMN IF NOT EXISTS evidence_type text NOT NULL DEFAULT 'photo',
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'uploaded',
ADD COLUMN IF NOT EXISTS points_awarded integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS admin_comment text,
ADD COLUMN IF NOT EXISTS elapsed_seconds integer,
ADD COLUMN IF NOT EXISTS remaining_seconds integer,
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.captains_events
SET
  slug = COALESCE(slug, id::text),
  public_url = COALESCE(NULLIF(public_url, ''), '/capitanes/' || COALESCE(slug, id::text)),
  qr_url = COALESCE(qr_url, '/capitanes/' || COALESCE(slug, id::text))
WHERE slug IS NULL OR public_url = '' OR qr_url IS NULL;

UPDATE public.captains_challenge_catalog
SET
  description = COALESCE(description, title),
  category = COALESCE(category, 'General'),
  difficulty = COALESCE(difficulty, 'easy'),
  default_points = COALESCE(default_points, 10),
  evidence_type = COALESCE(evidence_type, 'photo'),
  is_active = COALESCE(is_active, true);

NOTIFY pgrst, 'reload schema';
