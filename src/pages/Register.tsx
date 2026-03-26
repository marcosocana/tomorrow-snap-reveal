import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logoRevelao from "@/assets/logo__revelao.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useDemoI18n } from "@/lib/demoI18n";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, pathPrefix } = useDemoI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    phone: "",
    acceptLegal: false,
    acceptMarketing: false,
  });

  const isFormComplete =
    formData.email.trim().length > 0 &&
    formData.password.trim().length > 0 &&
    formData.passwordConfirm.trim().length > 0 &&
    formData.acceptLegal;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const email = formData.email.trim().toLowerCase();
    const password = formData.password.trim();
    const passwordConfirm = formData.passwordConfirm.trim();
    const phone = formData.phone.trim();

    if (!formData.acceptLegal) {
      toast({
        title: t("form.errors.legalRequiredTitle"),
        description: t("form.errors.legalRequired"),
        variant: "destructive",
      });
      return;
    }

    if (password !== passwordConfirm) {
      toast({
        title: t("form.errors.passwordMismatchTitle"),
        description: t("form.errors.passwordMismatch"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-user", {
        body: {
          email,
          password,
          phone: phone || null,
          marketingConsent: formData.acceptMarketing,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error === "EMAIL_EXISTS") {
        navigate(
          `${pathPrefix}/admin-login?reason=exists&email=${encodeURIComponent(email)}`,
          { replace: true },
        );
        return;
      }

      navigate(
        `${pathPrefix}/admin-login?reason=registered&email=${encodeURIComponent(email)}`,
        { replace: true },
      );
    } catch (error: any) {
      console.error("Error registering user:", error);
      toast({
        title: "No se pudo completar el registro",
        description: "Inténtalo de nuevo en unos minutos.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8" data-scroll-container>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 animate-fade-in">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <img
              src={logoRevelao}
              alt="Revelao"
              className="w-64 h-auto"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Crea tu cuenta
            </h1>
            <p className="text-muted-foreground">
              Accede a tu area privada aunque todavia no hayas creado ningun evento.
            </p>
          </div>
        </div>

        <Card className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">
                  Usuario
                  <span className="text-red-500"> *</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder={t("form.step2.emailPlaceholder")}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {t("form.step2.password")}
                  <span className="text-red-500"> *</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder={t("form.step2.passwordPlaceholder")}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">
                  {t("form.step2.passwordConfirm")}
                  <span className="text-red-500"> *</span>
                </Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  value={formData.passwordConfirm}
                  onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                  required
                  placeholder={t("form.step2.passwordConfirmPlaceholder")}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone">{t("form.step2.phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t("form.step2.phonePlaceholder")}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={formData.acceptLegal}
                  onChange={(e) => setFormData({ ...formData, acceptLegal: e.target.checked })}
                />
                <span>
                  He leido y acepto los{" "}
                  <a
                    href={`${pathPrefix}/terms`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Terminos y Condiciones
                  </a>{" "}
                  y la{" "}
                  <a
                    href={`${pathPrefix}/privacy`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Politica de Privacidad
                  </a>
                  <span className="text-red-500"> *</span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-border"
                  checked={formData.acceptMarketing}
                  onChange={(e) => setFormData({ ...formData, acceptMarketing: e.target.checked })}
                />
                <span>Autorizo el envio de comunicaciones comerciales por email.</span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isFormComplete || isSubmitting}
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;
