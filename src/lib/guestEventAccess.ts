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

/** Parámetro con el código del QR en las URLs de cámara y galería. */
export const GUEST_EVENT_QUERY_KEY = "e";

/**
 * URL de la cámara o la galería que identifica el evento (`?e=<código>`), para
 * que funcione al compartirla, abrirla en otro navegador o volver días después.
 */
export const guestPagePath = (page: "/camera" | "/gallery", code: string | null | undefined, demoEnv: boolean) => {
  const params = new URLSearchParams();
  const normalizedCode = code?.trim();
  if (normalizedCode) params.set(GUEST_EVENT_QUERY_KEY, normalizedCode);
  if (demoEnv) params.set("demo_env", "1");
  const query = params.toString();
  return query ? `${page}?${query}` : page;
};

/**
 * Si la URL trae un evento (`?e=<código>`) que este navegador no tiene abierto,
 * devuelve la URL del QR de ese evento para resolverlo igual que al escanearlo
 * (incluida la contraseña de QR si el organizador la pide). Si ya es el evento
 * guardado, o la URL no trae código, devuelve null y la página sigue como siempre.
 */
export const guestEventLinkRedirect = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const code = params.get(GUEST_EVENT_QUERY_KEY)?.trim();
  if (!code) return null;
  let storedCode: string | null = null;
  let storedEventId: string | null = null;
  try {
    storedCode = getPersistedGuestEventPassword()?.trim() ?? null;
    storedEventId = localStorage.getItem("eventId");
  } catch {
    // Sin almacenamiento se resuelve siempre por la URL del QR.
  }
  if (storedEventId && storedCode === code) return null;
  const qrParams = new URLSearchParams();
  if (params.get("demo_env") === "1") qrParams.set("demo_env", "1");
  const qrQuery = qrParams.toString();
  return `/events/${encodeURIComponent(code)}${qrQuery ? `?${qrQuery}` : ""}`;
};

const GUEST_PAGES = new Set(["/camera", "/gallery", "/bulk-upload"]);
const QR_PATH = /^\/events?\/([^/]+)\/?$/;
const DEFAULT_MANIFEST_HREF = "/manifest.json";

/**
 * Código del evento para la página actual del invitado: el de la URL del QR
 * (`/events/<código>` o `/event/<código>`) o el guardado al escanearlo.
 */
const guestEventCodeFor = (pathname: string, search: string) => {
  const qrMatch = pathname.match(QR_PATH);
  if (qrMatch) return decodeURIComponent(qrMatch[1]);
  if (!GUEST_PAGES.has(pathname)) return null;
  const linkedCode = new URLSearchParams(search).get(GUEST_EVENT_QUERY_KEY);
  if (linkedCode) return linkedCode;
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
export const syncGuestEventManifest = (pathname: string, search = "") => {
  const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) return;
  const code = guestEventCodeFor(pathname, search)?.trim();
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
