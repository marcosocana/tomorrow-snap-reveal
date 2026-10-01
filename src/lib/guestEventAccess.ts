const GUEST_EVENT_PASSWORD_KEY = "guestEventPassword";

export const persistGuestEventPassword = (password: string | null | undefined) => {
  const normalizedPassword = password?.trim();
  if (!normalizedPassword) return;
  localStorage.setItem(GUEST_EVENT_PASSWORD_KEY, normalizedPassword);
};

export const getPersistedGuestEventPassword = () => localStorage.getItem(GUEST_EVENT_PASSWORD_KEY);

export const clearPersistedGuestEventPassword = () => {
  localStorage.removeItem(GUEST_EVENT_PASSWORD_KEY);
};

const GUEST_PAGES = new Set(["/camera", "/gallery", "/bulk-upload"]);
const QR_PATH = /^\/events?\/([^/]+)\/?$/;
const DEFAULT_MANIFEST_HREF = "/manifest.json";

/**
 * Código del evento para la página actual del invitado: el de la URL del QR
 * (`/events/<código>` o `/event/<código>`) o el guardado al escanearlo.
 */
const guestEventCodeFor = (pathname: string) => {
  const qrMatch = pathname.match(QR_PATH);
  if (qrMatch) return decodeURIComponent(qrMatch[1]);
  if (!GUEST_PAGES.has(pathname)) return null;
  try {
    return getPersistedGuestEventPassword();
  } catch {
    return null;
  }
};

/**
 * Si un invitado añade la web a su pantalla de inicio, el icono debe abrir su
 * evento y no el login de administración (`start_url: "/"` del manifest
 * global). En las páginas de invitado se usa un manifest cuyo inicio es la
 * misma URL del QR del evento, que se resuelve igual que al escanearlo.
 */
export const syncGuestEventManifest = (pathname: string) => {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  const code = guestEventCodeFor(pathname)?.trim();
  if (!code) {
    if (link.getAttribute("href") !== DEFAULT_MANIFEST_HREF) link.setAttribute("href", DEFAULT_MANIFEST_HREF);
    return;
  }
  const origin = window.location.origin;
  const manifest = {
    name: "Revelao.cam - Captura hoy, revela mañana",
    short_name: "Revelao",
    description: "Una experiencia fotográfica nostálgica tipo cámara desechable",
    start_url: `${origin}/events/${encodeURIComponent(code)}`,
    scope: `${origin}/`,
    display: "standalone",
    background_color: "#FFF8F0",
    theme_color: "#D2691E",
    icons: [
      { src: `${origin}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `${origin}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
  link.setAttribute("href", `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`);
};
