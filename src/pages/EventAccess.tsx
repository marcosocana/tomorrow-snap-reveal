import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { persistGuestEventPassword } from "@/lib/guestEventAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hashPassword } from "@/lib/hashPassword";
import { getEventQrPasswordSettings, shouldRequestQrPassword } from "@/lib/eventQrPassword";
import logoRevelao from "@/assets/logo__revelao.png";

type AccessChallenge = {
  event: EventRow;
  actualPassword: string;
  isBulkMode: boolean;
  demoEnvEnabled: boolean;
  target: "camera" | "gallery";
};

type EventRow = Database["public"]["Tables"]["events"]["Row"];

const EventAccess = () => {
  const { password } = useParams<{ password: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accessChallenge, setAccessChallenge] = useState<AccessChallenge | null>(null);
  const [qrPassword, setQrPassword] = useState("");
  const [qrPasswordError, setQrPasswordError] = useState("");

  const completeGuestAccess = useCallback((
    event: EventRow,
    actualPassword: string,
    isBulkMode: boolean,
    demoEnvEnabled: boolean,
    qrPasswordGrantedTarget?: "camera" | "gallery"
  ) => {
    persistGuestEventPassword(actualPassword);
    localStorage.setItem("eventId", event.id);
    localStorage.setItem("eventName", event.name);
    localStorage.setItem("eventLanguage", event.language || "es");
    localStorage.setItem("eventTimezone", event.timezone || "Europe/Madrid");
    localStorage.removeItem("isAdmin");

    if (isBulkMode) {
      localStorage.setItem("bulkUploadMode", "true");
      navigate("/bulk-upload");
      return;
    }

    const revealTime = new Date(event.reveal_time);
    const now = new Date();

    if (now >= revealTime) {
      navigate(demoEnvEnabled ? "/gallery?demo_env=1" : "/gallery", {
        state:
          qrPasswordGrantedTarget === "gallery"
            ? { qrPasswordGrantedForEventId: event.id, qrPasswordGrantedTarget: "gallery" }
            : undefined,
      });
    } else {
      navigate(demoEnvEnabled ? "/camera?demo_env=1" : "/camera");
    }
  }, [navigate]);

  const handleQrPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessChallenge) return;

    const expectedPasswordHash = getEventQrPasswordSettings(accessChallenge.event.limits_json).hash;
    const enteredPasswordHash = await hashPassword(qrPassword.trim());
    if (enteredPasswordHash !== expectedPasswordHash) {
      setQrPasswordError("Contraseña incorrecta");
      return;
    }

    setQrPasswordError("");
    completeGuestAccess(
      accessChallenge.event,
      accessChallenge.actualPassword,
      accessChallenge.isBulkMode,
      accessChallenge.demoEnvEnabled,
      accessChallenge.target
    );
  };

  useEffect(() => {
    const handleEventAccess = async () => {
      if (!password) {
        navigate("/");
        return;
      }

      const searchParams = new URLSearchParams(location.search);
      const demoEnvEnabled = searchParams.get("demo_env") === "1";
      if (demoEnvEnabled) {
        localStorage.setItem("demoEnvironmentMode", "1");
      } else {
        localStorage.removeItem("demoEnvironmentMode");
      }

      try {
        // Check if password ends with "x2" for bulk upload mode
        const isBulkMode = password.endsWith("x2");
        const actualPassword = isBulkMode ? password.slice(0, -2) : password;

        // Check for event admin password
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
          const event = events[0];
          const revealTime = new Date(event.reveal_time);
          const target = isBulkMode || new Date() < revealTime ? "camera" : "gallery";
          if (shouldRequestQrPassword(event.limits_json, target)) {
            setAccessChallenge({ event, actualPassword, isBulkMode, demoEnvEnabled, target });
            setQrPassword("");
            setQrPasswordError("");
            return;
          }

          completeGuestAccess(event, actualPassword, isBulkMode, demoEnvEnabled);
        } else {
          toast({
            title: "Evento no encontrado",
            description: "La URL del evento no es válida",
            variant: "destructive",
          });
          navigate("/");
        }
      } catch (error) {
        console.error("Error accessing event:", error);
        toast({
          title: "Error",
          description: "Hubo un problema al acceder al evento",
          variant: "destructive",
        });
        navigate("/");
      }
    };

    handleEventAccess();
  }, [password, navigate, toast, location.search, completeGuestAccess]);

  if (accessChallenge) {
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
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                {accessChallenge.event.name}
              </h1>
              <p className="text-muted-foreground">
                Introduce la contraseña para acceder al evento.
              </p>
            </div>
          </div>

          <form onSubmit={handleQrPasswordSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Contraseña del evento"
              value={qrPassword}
              onChange={(e) => {
                setQrPassword(e.target.value);
                setQrPasswordError("");
              }}
              className="h-14 text-lg bg-card border-2 border-border focus:border-primary transition-colors"
              autoFocus
              required
            />
            {qrPasswordError && (
              <p className="text-sm text-destructive">{qrPasswordError}</p>
            )}
            <Button
              type="submit"
              className="w-full h-14 text-lg bg-[hsl(5_85%_65%)] hover:bg-[hsl(5_85%_60%)] text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Entrar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">Accediendo al evento...</p>
      </div>
    </div>
  );
};

export default EventAccess;
