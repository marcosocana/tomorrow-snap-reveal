import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminI18n } from "@/lib/adminI18n";
import logoRevelao from "@/assets/logo-revelao.png";

const AdminResetPassword = () => {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();

  useEffect(() => {
    const checkSession = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDescription = url.searchParams.get("error_description");

      if (errorDescription) {
        toast({
          title: t("reset.errorTitle"),
          description: decodeURIComponent(errorDescription),
          variant: "destructive",
        });
      }

      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setHasSession(!!data.session);
          window.history.replaceState(null, "", `${pathPrefix}/reset-password`);
          return;
        } catch (error) {
          console.error("Error exchanging code for session:", error);
          toast({
            title: t("reset.errorTitle"),
            description: t("reset.errorDesc"),
            variant: "destructive",
          });
        }
      } else {
        const hash = new URLSearchParams(window.location.hash.replace("#", ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            setHasSession(!!data.session);
            window.history.replaceState(null, "", `${pathPrefix}/reset-password`);
            return;
          } catch (error) {
            console.error("Error setting session from hash:", error);
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
    };
    checkSession();
  }, [pathPrefix, t, toast]);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSending(true);
    try {
      const redirectTo = `${window.location.origin}${pathPrefix}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast({
        title: t("reset.sentTitle"),
        description: t("reset.sentDesc"),
      });
    } catch (error) {
      console.error("Error sending reset email:", error);
      toast({
        title: t("reset.errorTitle"),
        description: t("reset.errorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8 || newPassword !== repeatPassword) {
      toast({
        title: t("reset.errorTitle"),
        description: t("reset.passwordMismatch"),
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({
        title: t("reset.successTitle"),
        description: t("reset.successDesc"),
      });
      navigate(`${pathPrefix}/admin-login`);
    } catch (error) {
      console.error("Error updating password:", error);
      toast({
        title: t("reset.errorTitle"),
        description: t("reset.errorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <p className="text-muted-foreground text-lg font-mono tracking-wide">
            {t("reset.subtitle")}
          </p>
        </div>

        {hasSession ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("reset.newPassword")}
              className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
              required
              autoComplete="new-password"
            />
            <Input
              id="repeat-password"
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              placeholder={t("reset.repeatPassword")}
              className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
              required
              autoComplete="new-password"
            />
            <Button
              type="submit"
              className="w-full h-12 text-base bg-[hsl(5_85%_65%)] hover:bg-[hsl(5_85%_60%)] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={isUpdating}
            >
              {isUpdating ? t("reset.updating") : t("reset.update")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSendReset} className="space-y-4">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("reset.email")}
              className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
              required
              autoComplete="email"
            />
            <Button
              type="submit"
              className="w-full h-12 text-base bg-[hsl(5_85%_65%)] hover:bg-[hsl(5_85%_60%)] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              disabled={isSending}
            >
              {isSending ? t("reset.sending") : t("reset.send")}
            </Button>
          </form>
        )}

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate(`${pathPrefix}/admin-login`)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("reset.backToLogin")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminResetPassword;
