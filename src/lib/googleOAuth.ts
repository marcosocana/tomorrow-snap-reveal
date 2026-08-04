import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_OAUTH_MESSAGE = "revelao:google-oauth-complete";

export type GoogleOAuthProfile = {
  email: string;
  name: string;
};

export const signInWithGooglePopup = async (nextPath: string): Promise<GoogleOAuthProfile> => {
  const width = 520;
  const height = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    "about:blank",
    "revelao-google-oauth",
    `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
  );

  if (!popup) {
    throw new Error("GOOGLE_POPUP_BLOCKED");
  }

  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    popup.close();
    throw error || new Error("GOOGLE_OAUTH_URL_MISSING");
  }

  popup.location.href = data.url;

  return new Promise<GoogleOAuthProfile>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => finish(new Error("GOOGLE_OAUTH_TIMEOUT")), 120_000);
    const closedInterval = window.setInterval(() => {
      if (popup.closed) finish(new Error("GOOGLE_OAUTH_CANCELLED"));
    }, 500);

    const finish = (error?: Error, profile?: GoogleOAuthProfile) => {
      window.clearTimeout(timeoutId);
      window.clearInterval(closedInterval);
      window.removeEventListener("message", onMessage);
      if (!popup.closed) popup.close();
      if (error) reject(error);
      else if (profile) resolve(profile);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup) return;
      if (event.data?.type !== GOOGLE_OAUTH_MESSAGE) return;
      if (event.data?.error) {
        finish(new Error(String(event.data.error)));
        return;
      }
      finish(undefined, {
        email: String(event.data?.email || "").trim().toLowerCase(),
        name: String(event.data?.name || "").trim(),
      });
    };

    window.addEventListener("message", onMessage);
  });
};
