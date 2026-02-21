import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { useAdminI18n } from "@/lib/adminI18n";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();
  const redirectTo = new URLSearchParams(location.search).get("redirect");

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(redirectTo || `${pathPrefix}/event-management`);
      }
    };
    checkUser();
  }, [navigate, pathPrefix, redirectTo]);

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
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("login.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {t("login.subtitle")}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("login.button.loading") : t("login.button")}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AdminLogin;
