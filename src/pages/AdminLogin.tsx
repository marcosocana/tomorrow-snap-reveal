import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminI18n } from "@/lib/adminI18n";
import logoRevelao from "@/assets/logo__revelao.png";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();
  const searchParams = new URLSearchParams(location.search);
  const redirectTo = searchParams.get("redirect");
  const reason = searchParams.get("reason");
  const prefEmail = searchParams.get("email");

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(redirectTo || `${pathPrefix}/event-management`);
      }
    };
    checkUser();
    if (reason === "exists") {
      toast({
        title: "El email ya está registrado",
        description: "Inicia sesión para ver tus eventos.",
        variant: "destructive",
      });
      if (prefEmail) {
        setEmail(prefEmail);
      }
    }
  }, [navigate, pathPrefix, redirectTo, reason, prefEmail, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("auth-login", {
        body: { email, password },
      });

      if (error || !data?.session) {
        throw error || new Error("INVALID_CREDENTIALS");
      }

      await supabase.auth.setSession(data.session);
      toast({
        title: t("login.successTitle"),
        description: t("login.successDesc"),
      });
      navigate(redirectTo || `${pathPrefix}/event-management`);
    } catch (error: any) {
      console.error("Error logging in:", error);
      toast({
        title: t("login.errorTitle"),
        description: t("login.errorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <img 
              src={logoRevelao} 
              alt="Revelao.com" 
              className="w-64 h-auto"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <p className="text-muted-foreground text-lg font-mono tracking-wide">
            Captura hoy, revela mañana
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("login.email")}
              className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.password")}
              className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
              required
              autoComplete="current-password"
            />
            <div className="text-right">
              <button
                type="button"
                onClick={() => navigate(`${pathPrefix}/reset-password`)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("login.forgot")}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base bg-[hsl(5_85%_65%)] hover:bg-[hsl(5_85%_60%)] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? t("login.button.loading") : t("login.button")}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
