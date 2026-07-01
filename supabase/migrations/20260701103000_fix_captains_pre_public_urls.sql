UPDATE public.captains_events
SET
  public_url = 'https://acceso.revelao.cam/capitanes/' || slug,
  qr_url = 'https://acceso.revelao.cam/capitanes/' || slug,
  updated_at = now()
WHERE slug IS NOT NULL
  AND (
    public_url IS NULL
    OR public_url = ''
    OR public_url LIKE 'http://localhost:%'
    OR public_url LIKE 'https://localhost:%'
    OR public_url LIKE 'http://127.0.0.1:%'
    OR public_url LIKE 'https://127.0.0.1:%'
    OR public_url LIKE '/capitanes/%'
    OR qr_url IS NULL
    OR qr_url = ''
    OR qr_url LIKE 'http://localhost:%'
    OR qr_url LIKE 'https://localhost:%'
    OR qr_url LIKE 'http://127.0.0.1:%'
    OR qr_url LIKE 'https://127.0.0.1:%'
    OR qr_url LIKE '/capitanes/%'
  );
