import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_OAUTH_MESSAGE } from "@/lib/googleOAuth";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const complete = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.user) throw sessionError || new Error("OAUTH_SESSION_MISSING");

        const message = {
          type: GOOGLE_OAUTH_MESSAGE,
          email: session.user.email || "",
          name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
        };

        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, window.location.origin);
          window.close();
          return;
        }

        navigate(searchParams.get("next") || "/event-management", { replace: true });
      } catch (callbackError) {
        console.error("Google OAuth callback error:", callbackError);
        if (!active) return;
        setError(true);
        window.opener?.postMessage(
          { type: GOOGLE_OAUTH_MESSAGE, error: "GOOGLE_OAUTH_FAILED" },
          window.location.origin,
        );
      }
    };

    void complete();
    return () => {
      active = false;
    };
  }, [navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="text-muted-foreground">
        {error ? "No se pudo completar el acceso con Google." : "Completando acceso con Google..."}
      </p>
    </main>
  );
};

export default OAuthCallback;
