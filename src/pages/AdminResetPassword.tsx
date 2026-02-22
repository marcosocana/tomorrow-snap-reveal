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
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
      setHasToken(true);
    }
  }, []);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-password-reset", {
        body: { email },
      });
      if (error || data?.error) throw error || new Error(data?.error || "ERROR");
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
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { token, password: newPassword },
      });
      if (error || data?.error) throw error || new Error(data?.error || "ERROR");
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

        {hasToken ? (
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
