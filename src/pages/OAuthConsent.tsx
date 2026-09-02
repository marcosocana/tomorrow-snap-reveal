import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoRevelao from "@/assets/logo__revelao.png";

type AuthorizationClient = { name?: string; client_name?: string };
type AuthorizationDetails = {
  client?: AuthorizationClient;
  redirect_url?: string;
  redirect_to?: string;
};

type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Falta el parámetro authorization_id.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/login?redirect=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió una redirección.");
      return;
    }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "esta aplicación";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8 text-center animate-fade-in">
        <img
          src={logoRevelao}
          alt="Revelao"
          className="w-48 h-auto mx-auto"
          style={{ imageRendering: "pixelated" }}
        />

        {error ? (
          <p className="text-sm text-destructive font-mono">{error}</p>
        ) : !details ? (
          <p className="text-muted-foreground font-mono">Cargando…</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">Conectar {clientName}</h1>
              <p className="text-muted-foreground text-sm">
                {clientName} podrá consultar y gestionar tus eventos de Revelao en tu nombre. Puedes
                revocar el acceso en cualquier momento.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                className="w-full h-12 text-base bg-[hsl(5_85%_65%)] hover:bg-[hsl(5_85%_60%)] text-white font-semibold rounded-xl"
                disabled={busy}
                onClick={() => decide(true)}
              >
                Autorizar
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 text-base rounded-xl"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default OAuthConsent;
