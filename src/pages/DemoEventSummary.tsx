import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import logoRevelao from "@/assets/logo-revelao.png";

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
}

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

const DemoEventSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const event = location.state?.event as EventData | undefined;
  const contactInfo = location.state?.contactInfo as ContactInfo | undefined;

  // Redirect if no event data
  if (!event) {
    return <Navigate to="/nuevoeventodemo" replace />;
  }

  const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
  const adminUrl = "https://acceso.revelao.cam";
  const eventTz = event.timezone || "Europe/Madrid";

  const formatEventDate = (dateString: string) => {
    try {
      const date = toZonedTime(new Date(dateString), eventTz);
      return format(date, "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
    } catch {
      return dateString;
    }
  };

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
        {/* Header */}
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

        {/* Event Details Card */}
        <Card className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{event.name}</h2>
            <p className="text-muted-foreground mt-1">Evento de prueba • Máximo {event.max_photos} fotos</p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <QRCodeSVG 
                value={eventUrl} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Los invitados pueden escanear este código QR para acceder al evento
            </p>
          </div>

          {/* Event Info */}
          <div className="space-y-4 border-t border-border pt-4">
            {/* Event URL */}
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

            {/* Event Password */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Contraseña del evento</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                  {event.password_hash}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(event.password_hash, 'password')}
                >
                  {copiedField === 'password' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Admin Password */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Contraseña de administrador</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded text-sm font-mono border border-amber-200 dark:border-amber-800">
                  {event.admin_password}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(event.admin_password, 'admin')}
                >
                  {copiedField === 'admin' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Dates */}
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

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Fecha de revelado</label>
              <p className="text-sm">{formatEventDate(event.reveal_time)}</p>
            </div>
          </div>
        </Card>

        {/* Admin Access Instructions */}
        <Card className="p-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-lg">🔐</span>
            Cómo gestionar tu evento
          </h3>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Para ver las fotos y administrar tu evento, sigue estos pasos:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Entra en{" "}
                <a 
                  href={adminUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  acceso.revelao.cam
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Introduce tu <strong>contraseña de administrador</strong>: <code className="bg-background px-1 rounded">{event.admin_password}</code></li>
              <li>Podrás ver todas las fotos incluso antes del revelado</li>
            </ol>
          </div>
        </Card>

        {/* Contact Info Confirmation */}
        {contactInfo && (
          <Card className="p-6 bg-muted/30">
            <h3 className="font-semibold text-foreground mb-3">Tus datos de contacto</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Nombre</label>
                <p className="font-medium">{contactInfo.name}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Email</label>
                <p className="font-medium">{contactInfo.email}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Teléfono</label>
                <p className="font-medium">{contactInfo.phone}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate("/nuevoeventodemo")}
          >
            Crear otro evento
          </Button>
          <Button 
            className="flex-1"
            onClick={() => window.open(eventUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Ir al evento
          </Button>
        </div>

        {/* Help */}
        <p className="text-center text-sm text-muted-foreground">
          ¿Algún problema?{" "}
          <a
            href="https://wa.me/34695834018?text=Hola%2C%20acabo%20de%20crear%20un%20evento%20de%20prueba%20y%20tengo%20una%20duda."
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

export default DemoEventSummary;
