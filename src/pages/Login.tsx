import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera } from "lucide-react";

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


      // Check for event admin password (ver fotos antes del revelado)
      const { data: adminEvents, error: adminError } = await supabase
        .from("events")
        .select("*")
        .eq("admin_password", password)
        .limit(1);

      if (!adminError && adminEvents && adminEvents.length > 0) {
        localStorage.setItem("eventId", adminEvents[0].id);
        localStorage.setItem("eventName", adminEvents[0].name);
        localStorage.setItem("isAdmin", "true");
        navigate("/gallery");
        return;
      }

      // Normal user flow
      const { data: events, error } = await supabase
        .from("events")
        .select("*")
        .eq("password_hash", password)
        .limit(1);

      if (error) throw error;

      if (events && events.length > 0) {
        // Store event ID in localStorage
        localStorage.setItem("eventId", events[0].id);
        localStorage.setItem("eventName", events[0].name);
        localStorage.removeItem("isAdmin");
        
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
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            TomorrowCam
          </h1>
          <p className="text-muted-foreground text-lg">
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
          Introduce la contraseña del evento para comenzar
        </p>
      </div>
    </div>
  );
};

export default Login;