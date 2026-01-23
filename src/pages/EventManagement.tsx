import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Trash2, Edit, Copy, Home, Download, MessageCircle, ChevronDown, RefreshCw, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { getCountryByCode } from "@/lib/countries";
import { getLanguageByCode } from "@/lib/translations";
import { QRCodeSVG } from "qrcode.react";
import { FilterType } from "@/lib/photoFilters";
import { getEventStatus } from "@/lib/eventStatus";
import GalleryPreviewModal from "@/components/GalleryPreviewModal";

interface Event {
  id: string;
  name: string;
  password_hash: string;
  admin_password: string | null;
  reveal_time: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  max_photos: number | null;
  custom_image_url: string | null;
  background_image_url: string | null;
  filter_type: FilterType;
  font_family: string;
  font_size: string;
  created_at: string;
  is_demo: boolean;
  country_code: string;
  timezone: string;
  language: string;
  description: string | null;
  expiry_date: string | null;
  expiry_redirect_url: string | null;
}

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventPhotoCounts, setEventPhotoCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      if (isDemoMode) {
        loadEvents();
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin-login");
        return;
      }
      loadEvents();
    };

    checkAuth();

    if (!isDemoMode) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!session) {
          navigate("/admin-login");
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [navigate, isDemoMode]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("is_demo", isDemoMode)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents((data || []) as Event[]);

      if (data) {
        const counts: Record<string, number> = {};
        for (const event of data) {
          const { count, error: countError } = await supabase
            .from("photos")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id);
          
          if (!countError) {
            counts[event.id] = count || 0;
          }
        }
        setEventPhotoCounts(counts);
      }
    } catch (error) {
      console.error("Error loading events:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los eventos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleReveal = async (event: Event, isRevealed: boolean) => {
    try {
      if (isRevealed) {
        const newRevealTime = new Date();
        newRevealTime.setHours(newRevealTime.getHours() + 24);

        const { error } = await supabase
          .from("events")
          .update({ reveal_time: newRevealTime.toISOString() })
          .eq("id", event.id);

        if (error) throw error;

        toast({
          title: "Evento reabierto",
          description: "El evento se ha abierto de nuevo. Las fotos se revelarán en 24 horas.",
        });
      } else {
        const { error } = await supabase
          .from("events")
          .update({ reveal_time: new Date().toISOString() })
          .eq("id", event.id);

        if (error) throw error;

        toast({
          title: "Fotos reveladas",
          description: "Las fotos ya son visibles para todos",
        });
      }

      loadEvents();
    } catch (error) {
      console.error("Error toggling reveal:", error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del evento",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este evento?")) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Evento eliminado",
        description: "El evento se eliminó correctamente",
      });

      loadEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el evento",
        variant: "destructive",
      });
    }
  };

  const handleCopyUrl = async (password: string) => {
    const eventUrl = `https://acceso.revelao.cam/events/${password}`;
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast({
        title: "URL copiada",
        description: "La URL del evento se ha copiado al portapapeles",
      });
    } catch (error) {
      console.error("Error copying URL:", error);
    }
  };

  const handleDownloadQR = async (eventUrl: string, eventName: string, eventId: string) => {
    try {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      const qrSize = 1024;
      const qrWrapper = document.createElement('div');
      container.appendChild(qrWrapper);
      
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(qrWrapper);
      
      await new Promise<void>((resolve) => {
        root.render(
          <QRCodeSVG value={eventUrl} size={qrSize} level="H" />
        );
        setTimeout(resolve, 100);
      });

      const svgElement = qrWrapper.querySelector('svg');
      if (!svgElement) throw new Error('No se pudo generar el QR');

      const canvas = document.createElement('canvas');
      canvas.width = qrSize;
      canvas.height = qrSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('No se pudo crear el canvas');

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a');
            link.download = `qr-${eventName.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            
            toast({
              title: "QR descargado",
              description: "El código QR se ha descargado correctamente",
            });
          }
          
          URL.revokeObjectURL(url);
          root.unmount();
          document.body.removeChild(container);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        root.unmount();
        document.body.removeChild(container);
        throw new Error('Error al cargar la imagen');
      };

      img.src = url;
    } catch (error) {
      console.error("Error downloading QR:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar el código QR",
        variant: "destructive",
      });
    }
  };

  const handleCommunicateDemo = async (event: Event) => {
    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const eventTz = event.timezone || "Europe/Madrid";
    
    const uploadStartFormatted = event.upload_start_time 
      ? formatInTimeZone(new Date(event.upload_start_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
      : "";
    const uploadEndFormatted = event.upload_end_time 
      ? formatInTimeZone(new Date(event.upload_end_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
      : "";
    const revealFormatted = formatInTimeZone(new Date(event.reveal_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es });

    const message = `¡Hola! Te damos la bienvenida a la demo de Revelao.cam.

Te compartimos el código QR del evento y toda la información necesaria para acceder. Podrás entrar tanto escaneando el QR como a través del siguiente enlace: ${eventUrl}

Durante el evento, podrás hacer todas las fotos que quieras desde el ${uploadStartFormatted} hasta el ${uploadEndFormatted}.

Al día siguiente, el ${revealFormatted}, las fotos se revelarán automáticamente y podrás verlas desde el mismo espacio.

Para disfrutar al máximo de la experiencia, te recomendamos hacer cuantas más fotos mejor durante el periodo habilitado.

Si tienes cualquier problema o duda durante la demo, no dudes en contactarme.

¡Que lo disfrutes!`;

    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Mensaje copiado",
        description: "El mensaje de demo se ha copiado al portapapeles",
      });
    } catch (error) {
      console.error("Error copying message:", error);
      toast({
        title: "Error",
        description: "No se pudo copiar el mensaje",
        variant: "destructive",
      });
    }
  };

  const handleCommunicateEvent = async (event: Event) => {
    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const eventTz = event.timezone || "Europe/Madrid";
    
    const uploadStartFormatted = event.upload_start_time 
      ? formatInTimeZone(new Date(event.upload_start_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
      : "";
    const uploadEndFormatted = event.upload_end_time 
      ? formatInTimeZone(new Date(event.upload_end_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
      : "";
    const revealFormatted = formatInTimeZone(new Date(event.reveal_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es });
    const expiryFormatted = event.expiry_date 
      ? formatInTimeZone(new Date(event.expiry_date), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: es })
      : "";

    const message = `¡Hola! Te damos la bienvenida a la familia Revelao 💛

Nos encanta tenerte con nosotros. A continuación, te compartimos un resumen del evento que has dado de alta, con toda la información clave:


🔗 Acceso al evento
Puedes acceder escaneando el código QR del evento o directamente desde este enlace: ${eventUrl}


📅 Fechas del evento

El evento estará activo desde el ${uploadStartFormatted} hasta el ${uploadEndFormatted}.

Las fotos se revelarán el ${revealFormatted}.${expiryFormatted ? `

Las fotos caducarán el ${expiryFormatted}.` : ""}


📁 Almacenamiento de las fotos
Una vez caduque el evento, las fotos se subirán a un Drive.

Te recomendamos que sea vuestro propio Drive, para que podáis tenerlas ya almacenadas y gestionarlas libremente. En ese caso, necesitaremos que nos facilitéis la URL del Drive donde subirlas.

Si preferís que las subamos a nuestro Drive, indícanoslo y te explicamos cómo podréis acceder a ellas.

Para cualquier duda o ayuda adicional, estamos a vuestra disposición.

¡Esperamos que disfrutéis mucho de la experiencia Revelao!`;

    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: "Mensaje copiado",
        description: "El mensaje del evento se ha copiado al portapapeles",
      });
    } catch (error) {
      console.error("Error copying message:", error);
      toast({
        title: "Error",
        description: "No se pudo copiar el mensaje",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-full"
              title="Volver al inicio"
            >
              <Home className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {isDemoMode ? "Gestión de Eventos (Demo)" : "Gestión de Eventos"}
            </h1>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => {
                setIsLoading(true);
                loadEvents();
              }}
              title="Actualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => navigate("/event-form")}>
              <Plus className="w-4 h-4" />
              Nuevo Evento
            </Button>
          </div>
        </div>

        {events.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay eventos creados todavía
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => {
              const revealTime = new Date(event.reveal_time);
              const now = new Date();
              const isRevealed = now >= revealTime;
              const photoCount = eventPhotoCounts[event.id] || 0;
              const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
              const statusInfo = getEventStatus(
                event.upload_start_time,
                event.upload_end_time,
                event.reveal_time,
                event.expiry_date
              );

              return (
                <Card key={event.id} className="p-4 md:p-6">
                  <div className="flex flex-col lg:flex-row items-start gap-4 md:gap-6">
                    {/* QR Code Section */}
                    <div className="flex-shrink-0 space-y-2 w-full lg:w-auto">
                      <div className="bg-white p-3 rounded-lg border border-border mx-auto lg:mx-0 w-fit">
                        <QRCodeSVG value={eventUrl} size={120} />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadQR(eventUrl, event.name, event.id)}
                        className="w-full gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Descargar QR
                      </Button>
                      {/* Event Status Badge */}
                      <div className={`text-center text-sm font-medium px-3 py-1.5 rounded-md ${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 space-y-3 w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg md:text-xl font-semibold text-foreground">
                          {event.name}
                        </h3>
                        {(() => {
                          const country = getCountryByCode(event.country_code || "ES");
                          return country ? (
                            <span className="text-lg" title={country.name}>
                              {country.flag}
                            </span>
                          ) : null;
                        })()}
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isRevealed}
                            onCheckedChange={() => handleToggleReveal(event, isRevealed)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {isRevealed ? "Revelado" : "No revelado"}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {(() => {
                          const country = getCountryByCode(event.country_code || "ES");
                          return country ? (
                            <p>
                              <span className="font-medium">País:</span>{" "}
                              {country.flag} {country.name}
                            </p>
                          ) : null;
                        })()}
                        <p>
                          <span className="font-medium">Contraseña:</span>{" "}
                          {event.password_hash}
                        </p>
                        {event.admin_password && (
                          <p>
                            <span className="font-medium">Contraseña admin:</span>{" "}
                            {event.admin_password}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <p>
                            <span className="font-medium">Fotos añadidas:</span>{" "}
                            {photoCount}{event.max_photos ? ` / ${event.max_photos}` : ""}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPreviewEvent(event)}
                            className="h-6 px-2 text-xs gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Ver
                          </Button>
                        </div>
                        {event.max_photos && (
                          <p>
                            <span className="font-medium">Máximo de fotos:</span>{" "}
                            {event.max_photos}
                          </p>
                        )}
                        {event.upload_start_time && event.upload_end_time && (
                          <>
                            <p className="break-words">
                              <span className="font-medium">Período de subida:</span>{" "}
                              <span className="inline-block">
                                {formatInTimeZone(new Date(event.upload_start_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: es })} - {formatInTimeZone(new Date(event.upload_end_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: es })}
                              </span>
                              <span className="text-xs ml-1">({(() => {
                                const country = getCountryByCode(event.country_code || "ES");
                                return country ? `${country.flag} ${country.name}` : "España";
                              })()})</span>
                            </p>
                            {(event.country_code || "ES") !== "ES" && (
                              <p className="text-xs text-muted-foreground pl-4">
                                🇪🇸 En España: {formatInTimeZone(new Date(event.upload_start_time), "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: es })} - {formatInTimeZone(new Date(event.upload_end_time), "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: es })}
                              </p>
                            )}
                          </>
                        )}
                        <p>
                          <span className="font-medium">Fecha de revelado:</span>{" "}
                          {formatInTimeZone(revealTime, event.timezone || "Europe/Madrid", "PPP 'a las' HH:mm", { locale: es })}
                          <span className="text-xs ml-1">({(() => {
                            const country = getCountryByCode(event.country_code || "ES");
                            return country ? `${country.flag} ${country.name}` : "España";
                          })()})</span>
                        </p>
                        {(event.country_code || "ES") !== "ES" && (
                          <p className="text-xs text-muted-foreground pl-4">
                            🇪🇸 En España: {formatInTimeZone(revealTime, "Europe/Madrid", "PPP 'a las' HH:mm", { locale: es })}
                          </p>
                        )}
                        {event.language && event.language !== "es" && (
                          <p>
                            <span className="font-medium">Idioma:</span>{" "}
                            {(() => {
                              const lang = getLanguageByCode(event.language);
                              return lang ? `${lang.flag} ${lang.name}` : event.language;
                            })()}
                          </p>
                        )}
                        {event.expiry_date && (
                          <>
                            <p>
                              <span className="font-medium">Fecha de caducidad:</span>{" "}
                              {formatInTimeZone(new Date(event.expiry_date), event.timezone || "Europe/Madrid", "PPP", { locale: es })}
                            </p>
                            {event.expiry_redirect_url && (
                              <p className="text-xs text-muted-foreground pl-4 break-all">
                                Redirige a: {event.expiry_redirect_url}
                              </p>
                            )}
                          </>
                        )}
                        <p>
                          <span className="font-medium">Creado:</span>{" "}
                          {format(new Date(event.created_at), "PPP", { locale: es })}
                        </p>
                      </div>

                      {/* URL Section */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={eventUrl}
                          readOnly
                          className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleCopyUrl(event.password_hash)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-auto justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Comunicar</span>
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => handleCommunicateDemo(event)}>
                            Comunicar demo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCommunicateEvent(event)}>
                            Comunicar evento
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/event-form/${event.id}`)}
                        className="hover:bg-muted"
                        title="Editar evento"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Eliminar evento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Gallery Preview Modal */}
      <GalleryPreviewModal
        open={!!previewEvent}
        onOpenChange={(open) => !open && setPreviewEvent(null)}
        eventId={previewEvent?.id || ""}
        eventName={previewEvent?.name || ""}
        eventDescription={previewEvent?.description}
        backgroundImageUrl={previewEvent?.background_image_url}
        customImageUrl={previewEvent?.custom_image_url}
        fontFamily={previewEvent?.font_family}
        fontSize={previewEvent?.font_size}
        filterType={previewEvent?.filter_type}
      />
    </div>
  );
};

export default EventManagement;
