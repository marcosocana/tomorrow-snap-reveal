import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAdminI18n } from "@/lib/adminI18n";
import logoRevelao from "@/assets/logo__revelao.png";

const Register = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pathPrefix } = useAdminI18n();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptTerms) {
      toast({
        title: "Debes aceptar los términos",
        description: "Acepta los Términos y la Política de Privacidad para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Por favor, verifica que ambas contraseñas sean iguales.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("register-user", {
        body: { email, password, phone: phone || null, marketingOptIn },
      });

      if (error) throw error;

      if (data?.error === "USER_EXISTS") {
        toast({
          title: "El email ya está registrado",
          description: "Inicia sesión con tu cuenta existente.",
          variant: "destructive",
        });
        navigate(`${pathPrefix}/admin-login?reason=exists&email=${encodeURIComponent(email)}`);
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Set session if returned
      if (data?.session) {
        await supabase.auth.setSession(data.session);
      }

      toast({
        title: "¡Cuenta creada!",
        description: "Tu registro se ha completado con éxito.",
      });

      navigate(`${pathPrefix}/event-management`);
    } catch (error: any) {
      console.error("Register error:", error);
      toast({
        title: "Error al registrarse",
        description: "Ocurrió un error inesperado. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-background"
      data-scroll-container
    >
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
            Crea tu cuenta
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
            required
            autoComplete="email"
          />

          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
            required
            autoComplete="new-password"
          />

          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repetir contraseña"
            className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
            required
            autoComplete="new-password"
          />

          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Teléfono (opcional)"
            className="h-12 text-base bg-card border-2 border-border focus:border-primary transition-colors"
            autoComplete="tel"
          />

          <div className="space-y-3 pt-2">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked === true)}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                Acepto los{" "}
                <a href="/terms" target="_blank" className="text-primary hover:underline font-semibold">
                  Términos y Condiciones
                </a>{" "}
                y la{" "}
                <a href="/privacy" target="_blank" className="text-primary hover:underline font-semibold">
                  Política de Privacidad
                </a>
              </label>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="marketing"
                checked={marketingOptIn}
                onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
              />
              <label htmlFor="marketing" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                Quiero recibir comunicaciones comerciales y novedades
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base bg-[hsl(5_85%_65%)] hover:bg-[hsl(5_85%_60%)] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <a href={`${pathPrefix}/admin-login`} className="text-primary hover:underline font-semibold">
            Iniciar sesión
          </a>
        </p>
      </div>
    </div>
  );
};

export default Register;
