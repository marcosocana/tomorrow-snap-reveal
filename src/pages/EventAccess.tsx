import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EventAccess = () => {
  const { password } = useParams<{ password: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const handleEventAccess = async () => {
      if (!password) {
        navigate("/");
        return;
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
          localStorage.setItem("eventId", events[0].id);
          localStorage.setItem("eventName", events[0].name);
          localStorage.setItem("eventLanguage", events[0].language || "es");
          localStorage.setItem("eventTimezone", events[0].timezone || "Europe/Madrid");
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
  }, [password, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-lg text-muted-foreground">Accediendo al evento...</p>
      </div>
    </div>
  );
};

export default EventAccess;
