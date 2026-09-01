-- Hot guest-access lookups. The admin password is optional, so keep its index partial.
CREATE INDEX IF NOT EXISTS events_password_hash_idx
  ON public.events (password_hash);

CREATE INDEX IF NOT EXISTS events_admin_password_idx
  ON public.events (admin_password)
  WHERE admin_password IS NOT NULL;

-- Account event listings filter by owner and use newest-first ordering.
CREATE INDEX IF NOT EXISTS events_owner_created_at_idx
  ON public.events (owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS captains_events_owner_created_at_idx
  ON public.captains_events (owner_id, created_at DESC)
  WHERE owner_id IS NOT NULL;

-- Gallery, slideshow, preview and download queries all use this filter/order pair.
CREATE INDEX IF NOT EXISTS photos_event_captured_at_idx
  ON public.photos (event_id, captured_at ASC);

CREATE INDEX IF NOT EXISTS videos_event_captured_at_idx
  ON public.videos (event_id, captured_at ASC);

CREATE INDEX IF NOT EXISTS audios_event_captured_at_idx
  ON public.audios (event_id, captured_at ASC);