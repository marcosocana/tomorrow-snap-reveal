// Cleans up stale/invalid refresh tokens from the admin Supabase client so a
// broken session never blocks the public Captains flow (which uses its own
// anonymous client via `supabasePublic`). Sign the user out silently and
// remove local storage remnants; do NOT retry infinitely.
import { supabase } from "@/integrations/supabase/client";
import { clearSignedUrlCache } from "@/lib/signedUrlCache";

const INVALID_REFRESH_MATCHERS = [
  "invalid refresh token",
  "refresh token not found",
  "refresh_token_not_found",
];

const isInvalidRefreshError = (message: unknown): boolean => {
  if (typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return INVALID_REFRESH_MATCHERS.some((needle) => lower.includes(needle));
};

const purgeLocalSession = () => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage disabled */
  }
};

let installed = false;
export const installSupabaseAuthGuard = () => {
  if (installed) return;
  installed = true;

  let activeUserId: string | null = null;
  supabase.auth.onAuthStateChange((event, session) => {
    const nextUserId = session?.user.id ?? null;
    if (event === "SIGNED_OUT" || activeUserId !== nextUserId) {
      clearSignedUrlCache("authenticated");
    }
    activeUserId = nextUserId;
  });

  // Try to hydrate the session once. If the refresh token is invalid, drop it.
  supabase.auth.getSession().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (isInvalidRefreshError(message)) {
      purgeLocalSession();
      void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
  });

  // Catch async refresh failures raised by the internal timer.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "";
    if (isInvalidRefreshError(message)) {
      event.preventDefault();
      purgeLocalSession();
      void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
  });
};
