import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logoRevelao from "@/assets/logo-revelao.png";

const Login = () => {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Check for event management password
      if (password === "CreateEvent01") {
        localStorage.removeItem("isDemoMode");
        navigate("/event-management");
        return;
      }

      // Check for demo mode password
      if (password === "Demo0000_") {
        localStorage.setItem("isDemoMode", "true");
        navigate("/event-management");
        return;
      }

      // Check for admin password
      if (password === "123") {
        // Admin mode - set flag and get all events
        const { data: events, error } = await supabase
          .from("events")
          .select("*")
          .limit(1);

        if (error) throw error;

        if (events && events.length > 0) {
          localStorage.setItem("eventId", events[0].id);
          localStorage.setItem("eventName", events[0].name);
          localStorage.setItem("isAdmin", "true");
          navigate("/gallery");
          return;
        }
      }

      // Check if password ends with "x2" for bulk upload mode
      const isBulkMode = password.endsWith("x2");
      const actualPassword = isBulkMode ? password.slice(0, -2) : password;

      // Check for event admin password (ver fotos antes del revelado)
      const { data: adminEvents, error: adminError } = await supabase
        .from("events")
        .select("*")
        .eq("admin_password", actualPassword)
        .limit(1);

      if (!adminError && adminEvents && adminEvents.length > 0) {
        localStorage.setItem("eventId", adminEvents[0].id);
        localStorage.setItem("eventName", adminEvents[0].name);
        localStorage.setItem("eventLanguage", adminEvents[0].language || "es");
        localStorage.setItem("eventTimezone", adminEvents[0].timezone || "Europe/Madrid");
        localStorage.setItem("isAdmin", "true");
        localStorage.setItem("adminEventId", adminEvents[0].id);
        if (isBulkMode) {
          localStorage.setItem("bulkUploadMode", "true");
          navigate("/bulk-upload");
        } else {
          navigate("/event-management");
        }
        return;
      }

      // Normal user flow
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("password_hash", actualPassword)
        .limit(1);

      if (error) throw error;

      if (events && events.length > 0) {
        // Store event ID in localStorage
        localStorage.setItem("eventId", events[0].id);
        localStorage.setItem("eventName", events[0].name);
        localStorage.removeItem("isAdmin");
        
        if (isBulkMode) {
          localStorage.setItem("bulkUploadMode", "true");
          navigate("/bulk-upload");
          return;
        }
        
        // Check if reveal time has passed
        const revealTime = new Date(events[0].reveal_time);
        const now = new Date();
        
        if (now >= revealTime) {
          navigate("/gallery");
        } else {
          navigate("/camera");
        }
      } else {
        toast({
          title: "Contraseña incorrecta",
          description: "No se encontró ningún evento con esa contraseña",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error logging in:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al acceder al evento",
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

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Contraseña del evento"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-lg bg-card border-2 border-border focus:border-primary transition-colors"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            disabled={isLoading}
          >
            {isLoading ? "Accediendo..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Algún problema?{" "}
          <a
            href="https://wa.me/34695834018?text=Hola%2C%20tengo%20un%20problema%20con%20Revelao.%20%C2%BFMe%20puedes%20ayudar%3F"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold"
          >
            ¡Contáctanos!
          </a>
        </p>
      </div>
    </div>
  );
};

export default Login;