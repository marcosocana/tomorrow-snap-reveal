import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink, Download } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import logoRevelao from "@/assets/logo__revelao.png";
import { getEventShortUrl } from "@/lib/eventUrls";

interface EventData {
  id: string;
  name: string;
  password_hash: string;
  admin_password: string;
  reveal_time: string;
  upload_start_time: string;
  upload_end_time: string;
  timezone: string;
  max_photos: number;
  expiry_date?: string | null;
  expiry_redirect_url?: string | null;
}

const PaidEventSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const event = location.state?.event as EventData | undefined;
  const qrFromState = location.state?.qrUrl as string | undefined;

  if (!event) {
    return <Navigate to="/event-management" replace />;
  }

  const eventUrl = getEventShortUrl(event.password_hash);
  const adminUrl = "https://acceso.revelao.cam";
  const eventTz = event.timezone || "Europe/Madrid";
  const storedQrUrl = event
    ? localStorage.getItem(`event-qr-url-${event.id}`) ||
      supabase.storage
        .from("event-photos")
        .getPublicUrl(`event-qr/qr-${event.id}.png`).data.publicUrl
    : "";
  const fallbackQrUrl = `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
    eventUrl
  )}`;
  const qrImageUrl = qrFromState || storedQrUrl || fallbackQrUrl;

  const downloadQR = useCallback(async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `qr-${event.name || "evento"}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(qrImageUrl, "_blank", "noopener,noreferrer");
    }
  }, [event.name, qrImageUrl]);

  const formatEventDate = (dateString: string) => {
    try {
      const date = toZonedTime(new Date(dateString), eventTz);
      return format(date, "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatDuration = () => {
    try {
      const start = toZonedTime(new Date(event.upload_start_time), eventTz);
      const end = toZonedTime(new Date(event.upload_end_time), eventTz);
      const totalMinutes = Math.max(0, differenceInMinutes(end, start));
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      const parts = [];
      if (days) parts.push(`${days} día${days === 1 ? "" : "s"}`);
      if (hours) parts.push(`${hours} hora${hours === 1 ? "" : "s"}`);
      if (!days && !hours) parts.push(`${minutes} min`);
      return parts.join(" y ");
    } catch {
      return "";
    }
  };

  const durationLabel = formatDuration();

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copiado",
        description: "Texto copiado al portapapeles",
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <img 
            src={logoRevelao} 
            alt="Revelao.com" 
            className="w-48 h-auto"
          />
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold">¡Evento creado con éxito!</span>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{event.name}</h2>
            <p className="text-muted-foreground mt-1">Evento de pago • Máximo {event.max_photos} fotos</p>
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <img
                src={qrImageUrl}
                alt="QR del evento"
                className="w-[200px] h-[200px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQR}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Descargar QR
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Los invitados pueden escanear este código QR para acceder al evento
            </p>
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">URL del evento</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm break-all">
                  {eventUrl}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(eventUrl, 'url')}
                >
                  {copiedField === 'url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Inicio de subida</label>
                <p className="text-sm">{formatEventDate(event.upload_start_time)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Fin de subida</label>
                <p className="text-sm">{formatEventDate(event.upload_end_time)}</p>
              </div>
            </div>

            {durationLabel ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Duración del evento</label>
                <p className="text-sm">{durationLabel}</p>
              </div>
            ) : null}

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Fecha de revelado</label>
              <p className="text-sm">{formatEventDate(event.reveal_time)}</p>
            </div>

            {event.expiry_date ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Fecha de caducidad</label>
                <p className="text-sm">{formatEventDate(event.expiry_date)}</p>
              </div>
            ) : null}

            {event.expiry_redirect_url ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">URL de redirección</label>
                <p className="text-sm break-all">{event.expiry_redirect_url}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Entra en{" "}
              <a
                href={adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                acceso.revelao.cam
              </a>{" "}
              o accede a través del siguiente botón.
            </p>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              asChild
            >
              <a href={adminUrl} target="_blank" rel="noopener noreferrer">
                Gestionar evento
              </a>
            </Button>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default PaidEventSummary;
