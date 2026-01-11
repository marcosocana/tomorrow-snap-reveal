import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ArrowLeft, Plus, Trash2, Edit, Eye, Copy, Upload, Home, Download, Globe } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import { COUNTRIES, getCountryByCode } from "@/lib/countries";
import { Language, getLanguageByCode } from "@/lib/translations";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { FilterType, FILTER_LABELS } from "@/lib/photoFilters";

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
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [newEvent, setNewEvent] = useState({
    name: "",
    password: "",
    adminPassword: "",
    uploadStartDate: "",
    uploadStartTime: "00:00",
    uploadEndDate: "",
    uploadEndTime: "23:59",
    revealDate: "",
    revealTime: "12:00",
    maxPhotos: isDemoMode ? "5" : "",
    customImage: null as File | null,
    customImageUrl: "",
    backgroundImage: null as File | null,
    backgroundImageUrl: "",
    filterType: "vintage" as FilterType,
    countryCode: "ES",
    timezone: "Europe/Madrid",
    language: "es",
    description: "",
    expiryDate: "",
    expiryRedirectUrl: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication - demo mode bypasses auth
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

    // Listen for auth changes (skip for demo mode)
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

      // Load photo counts for each event
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

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `event-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event-photos")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "No se pudo subir la imagen",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // Times are entered in the selected event timezone
      // We use fromZonedTime to convert from local timezone to UTC for storage
      const eventTz = newEvent.timezone;
      const uploadStartDateTime = fromZonedTime(`${newEvent.uploadStartDate}T${newEvent.uploadStartTime}:00`, eventTz);
      const uploadEndDateTime = fromZonedTime(`${newEvent.uploadEndDate}T${newEvent.uploadEndTime}:00`, eventTz);
      const revealDateTime = fromZonedTime(`${newEvent.revealDate}T${newEvent.revealTime}:00`, eventTz);

      let customImageUrl = newEvent.customImageUrl;
      if (newEvent.customImage) {
        const uploadedUrl = await handleImageUpload(newEvent.customImage);
        if (uploadedUrl) {
          customImageUrl = uploadedUrl;
        }
      }

      let backgroundImageUrl = newEvent.backgroundImageUrl;
      if (newEvent.backgroundImage) {
        const uploadedUrl = await handleImageUpload(newEvent.backgroundImage);
        if (uploadedUrl) {
          backgroundImageUrl = uploadedUrl;
        }
      }

      // Handle expiry date if provided
      const expiryDateTime = newEvent.expiryDate 
        ? fromZonedTime(`${newEvent.expiryDate}T23:59:00`, eventTz).toISOString()
        : null;

      if (editingEvent) {
        // Update existing event
        const { error } = await supabase
          .from("events")
          .update({
            name: newEvent.name,
            password_hash: newEvent.password,
            admin_password: newEvent.adminPassword || null,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: newEvent.maxPhotos ? parseInt(newEvent.maxPhotos) : null,
            custom_image_url: customImageUrl,
            background_image_url: backgroundImageUrl,
            filter_type: newEvent.filterType,
            country_code: newEvent.countryCode,
            timezone: newEvent.timezone,
            language: newEvent.language,
            description: newEvent.description || null,
            expiry_date: expiryDateTime,
            expiry_redirect_url: newEvent.expiryRedirectUrl || null,
          })
          .eq("id", editingEvent.id);

        if (error) throw error;

        toast({
          title: "Evento actualizado",
          description: "El evento se actualizó correctamente",
        });
      } else {
        // Create new event
        const { error } = await supabase.from("events").insert({
          name: newEvent.name,
          password_hash: newEvent.password,
          admin_password: newEvent.adminPassword || null,
          upload_start_time: uploadStartDateTime.toISOString(),
          upload_end_time: uploadEndDateTime.toISOString(),
          reveal_time: revealDateTime.toISOString(),
          max_photos: isDemoMode ? 5 : (newEvent.maxPhotos ? parseInt(newEvent.maxPhotos) : null),
          custom_image_url: customImageUrl,
          background_image_url: backgroundImageUrl,
          filter_type: newEvent.filterType,
          is_demo: isDemoMode,
          country_code: newEvent.countryCode,
          timezone: newEvent.timezone,
          language: newEvent.language,
          description: newEvent.description || null,
          expiry_date: expiryDateTime,
          expiry_redirect_url: newEvent.expiryRedirectUrl || null,
        });

        if (error) throw error;

        toast({
          title: "Evento creado",
          description: "El evento se creó correctamente",
        });
      }

      setNewEvent({
        name: "",
        password: "",
        adminPassword: "",
        uploadStartDate: "",
        uploadStartTime: "00:00",
        uploadEndDate: "",
        uploadEndTime: "23:59",
        revealDate: "",
        revealTime: "12:00",
        maxPhotos: isDemoMode ? "5" : "",
        customImage: null,
        customImageUrl: "",
        backgroundImage: null,
        backgroundImageUrl: "",
        filterType: "vintage",
        countryCode: "ES",
        timezone: "Europe/Madrid",
        language: "es",
        description: "",
        expiryDate: "",
        expiryRedirectUrl: "",
      });
      setEditingEvent(null);
      setIsDialogOpen(false);
      loadEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: editingEvent ? "No se pudo actualizar el evento" : "No se pudo crear el evento",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    // Times are stored in UTC, we display them in event's timezone for editing
    const eventTz = event.timezone || "Europe/Madrid";
    const uploadStartDate = event.upload_start_time ? toZonedTime(new Date(event.upload_start_time), eventTz) : new Date();
    const uploadEndDate = event.upload_end_time ? toZonedTime(new Date(event.upload_end_time), eventTz) : new Date();
    const revealDate = toZonedTime(new Date(event.reveal_time), eventTz);
    const expiryDate = event.expiry_date ? toZonedTime(new Date(event.expiry_date), eventTz) : null;
    setEditingEvent(event);
    setNewEvent({
      name: event.name,
      password: event.password_hash,
      adminPassword: event.admin_password || "",
      uploadStartDate: format(uploadStartDate, "yyyy-MM-dd"),
      uploadStartTime: format(uploadStartDate, "HH:mm"),
      uploadEndDate: format(uploadEndDate, "yyyy-MM-dd"),
      uploadEndTime: format(uploadEndDate, "HH:mm"),
      revealDate: format(revealDate, "yyyy-MM-dd"),
      revealTime: format(revealDate, "HH:mm"),
      maxPhotos: event.max_photos ? event.max_photos.toString() : "",
      customImage: null,
      customImageUrl: event.custom_image_url || "",
      backgroundImage: null,
      backgroundImageUrl: event.background_image_url || "",
      filterType: event.filter_type || "vintage",
      countryCode: event.country_code || "ES",
      timezone: event.timezone || "Europe/Madrid",
      language: event.language || "es",
      description: event.description || "",
      expiryDate: expiryDate ? format(expiryDate, "yyyy-MM-dd") : "",
      expiryRedirectUrl: event.expiry_redirect_url || "",
    });
    setIsDialogOpen(true);
  };

  const handleRevealNow = async (eventId: string) => {
    if (!confirm("¿Revelar todas las fotos ahora?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ reveal_time: new Date().toISOString() })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Fotos reveladas",
        description: "Las fotos ya son visibles para todos",
      });

      loadEvents();
    } catch (error) {
      console.error("Error revealing photos:", error);
      toast({
        title: "Error",
        description: "No se pudieron revelar las fotos",
        variant: "destructive",
      });
    }
  };

  const handleToggleReveal = async (event: Event, isRevealed: boolean) => {
    try {
      if (isRevealed) {
        // Reopen event - set reveal time to 24 hours from now
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
        // Reveal now
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
      // Create a temporary container with QR code
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Create a React root and render QR code
      const qrSize = 1024;
      const qrWrapper = document.createElement('div');
      container.appendChild(qrWrapper);
      
      // Import and use React to render the QR
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(qrWrapper);
      
      // Render QR code
      await new Promise<void>((resolve) => {
        root.render(
          <QRCodeSVG value={eventUrl} size={qrSize} level="H" />
        );
        setTimeout(resolve, 100);
      });

      // Get the SVG element
      const svgElement = qrWrapper.querySelector('svg');
      if (!svgElement) throw new Error('No se pudo generar el QR');

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = qrSize;
      canvas.height = qrSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('No se pudo crear el canvas');

      // Convert SVG to image
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Draw on canvas (transparent background by default)
        ctx.drawImage(img, 0, 0);
        
        // Convert to PNG and download
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
          
          // Cleanup
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

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingEvent(null);
              setNewEvent({
                name: "",
                password: "",
                adminPassword: "",
                uploadStartDate: "",
                uploadStartTime: "00:00",
                uploadEndDate: "",
                uploadEndTime: "23:59",
                revealDate: "",
                revealTime: "12:00",
                maxPhotos: isDemoMode ? "5" : "",
                customImage: null,
                customImageUrl: "",
                backgroundImage: null,
                backgroundImageUrl: "",
                filterType: "vintage",
                countryCode: "ES",
                timezone: "Europe/Madrid",
                language: "es",
                description: "",
                expiryDate: "",
                expiryRedirectUrl: "",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? "Editar Evento" : "Crear Nuevo Evento"}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                <form onSubmit={handleCreateEvent} className="space-y-4 pr-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      ¿Dónde es el evento?
                    </Label>
                    <CountrySelect
                      value={newEvent.countryCode}
                      onChange={(countryCode, timezone) =>
                        setNewEvent({ ...newEvent, countryCode, timezone })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Las horas se ajustarán a la zona horaria del país seleccionado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Idioma del evento</Label>
                    <LanguageSelect
                      value={newEvent.language as Language}
                      onChange={(language) =>
                        setNewEvent({ ...newEvent, language })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Las pantallas del evento se mostrarán en este idioma
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del evento</Label>
                    <Input
                      id="name"
                      value={newEvent.name}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña del evento</Label>
                    <Input
                      id="password"
                      type="text"
                      value={newEvent.password}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, password: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">
                      Contraseña admin (ver fotos antes del revelado)
                    </Label>
                    <Input
                      id="adminPassword"
                      type="text"
                      value={newEvent.adminPassword}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, adminPassword: e.target.value })
                      }
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxPhotos">
                      Máximo de fotos permitido
                    </Label>
                    {isDemoMode ? (
                      <div className="px-3 py-2 text-sm bg-muted rounded-md border border-border text-muted-foreground">
                        5 fotos (límite fijo en modo demo)
                      </div>
                    ) : (
                      <Input
                        id="maxPhotos"
                        type="number"
                        min="1"
                        value={newEvent.maxPhotos}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, maxPhotos: e.target.value })
                        }
                        placeholder="Ilimitado si se deja vacío"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="filterType">
                      Filtro de fotos
                    </Label>
                    <div className="flex gap-2">
                      {(["vintage", "35mm", "none"] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, filterType: filter })}
                          className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                            newEvent.filterType === filter
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted border-border hover:bg-muted/80"
                          }`}
                        >
                          {FILTER_LABELS[filter]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customImage">
                      Imagen personalizada (opcional)
                    </Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Máximo 240px ancho × 100px alto. Se muestra como icono en las pantallas.
                    </div>
                    {newEvent.customImageUrl && !newEvent.customImage && (
                      <div className="mb-2 relative inline-block">
                        <img 
                          src={newEvent.customImageUrl} 
                          alt="Preview" 
                          className="max-w-[240px] max-h-[100px] object-contain border border-border rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => setNewEvent({ ...newEvent, customImageUrl: "", customImage: null })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {newEvent.customImage && (
                      <div className="mb-2 relative inline-block">
                        <img 
                          src={URL.createObjectURL(newEvent.customImage)} 
                          alt="Preview" 
                          className="max-w-[240px] max-h-[100px] object-contain border border-border rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => setNewEvent({ ...newEvent, customImage: null })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input
                      id="customImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewEvent({ ...newEvent, customImage: file });
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backgroundImage">
                      Fotografía de fondo (opcional)
                    </Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Imagen que aparecerá como fondo en la cabecera de la galería y las pantallas del evento.
                    </div>
                    {newEvent.backgroundImageUrl && !newEvent.backgroundImage && (
                      <div className="mb-2 relative inline-block">
                        <img 
                          src={newEvent.backgroundImageUrl} 
                          alt="Preview fondo" 
                          className="max-w-full max-h-[120px] object-cover border border-border rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => setNewEvent({ ...newEvent, backgroundImageUrl: "", backgroundImage: null })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {newEvent.backgroundImage && (
                      <div className="mb-2 relative inline-block">
                        <img 
                          src={URL.createObjectURL(newEvent.backgroundImage)} 
                          alt="Preview fondo" 
                          className="max-w-full max-h-[120px] object-cover border border-border rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => setNewEvent({ ...newEvent, backgroundImage: null })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input
                      id="backgroundImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewEvent({ ...newEvent, backgroundImage: file });
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Descripción del evento (opcional)
                    </Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Máximo 200 caracteres. Se mostrará en la galería cuando las fotos estén reveladas.
                    </div>
                    <textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 200);
                        setNewEvent({ ...newEvent, description: value });
                      }}
                      placeholder="Ej: Boda de Ana y Carlos - 15 de Enero 2026"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      maxLength={200}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {newEvent.description.length}/200
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Período de subida de fotos</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="uploadStartDate">Fecha inicio</Label>
                        <Input
                          id="uploadStartDate"
                          type="date"
                          value={newEvent.uploadStartDate}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, uploadStartDate: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="uploadStartTime">Hora inicio</Label>
                        <Input
                          id="uploadStartTime"
                          type="time"
                          value={newEvent.uploadStartTime}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, uploadStartTime: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="uploadEndDate">Fecha fin</Label>
                        <Input
                          id="uploadEndDate"
                          type="date"
                          value={newEvent.uploadEndDate}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, uploadEndDate: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="uploadEndTime">Hora fin</Label>
                        <Input
                          id="uploadEndTime"
                          type="time"
                          value={newEvent.uploadEndTime}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, uploadEndTime: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    {newEvent.countryCode !== "ES" && newEvent.uploadStartDate && newEvent.uploadEndDate && (
                      <p className="text-xs text-muted-foreground">
                        🇪🇸 En España: {(() => {
                          try {
                            // Input is in local event timezone, convert to Spanish time for display
                            const eventTz = newEvent.timezone;
                            const spainTz = "Europe/Madrid";
                            
                            // Parse as local event time, convert to UTC, then to Spanish timezone
                            const startUtc = fromZonedTime(`${newEvent.uploadStartDate}T${newEvent.uploadStartTime}:00`, eventTz);
                            const endUtc = fromZonedTime(`${newEvent.uploadEndDate}T${newEvent.uploadEndTime}:00`, eventTz);
                            
                            const startInSpain = formatInTimeZone(startUtc, spainTz, "dd/MM/yyyy HH:mm");
                            const endInSpain = formatInTimeZone(endUtc, spainTz, "dd/MM/yyyy HH:mm");
                            
                            return `${startInSpain} - ${endInSpain}`;
                          } catch {
                            return "";
                          }
                        })()}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Fecha de revelado</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="revealDate">Fecha</Label>
                        <Input
                          id="revealDate"
                          type="date"
                          value={newEvent.revealDate}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, revealDate: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="revealTime">Hora</Label>
                        <Input
                          id="revealTime"
                          type="time"
                          value={newEvent.revealTime}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, revealTime: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                    {newEvent.countryCode !== "ES" && newEvent.revealDate && (
                      <p className="text-xs text-muted-foreground">
                        🇪🇸 En España: {(() => {
                          try {
                            // Input is in local event timezone, convert to Spanish time for display
                            const eventTz = newEvent.timezone;
                            const spainTz = "Europe/Madrid";
                            
                            const revealUtc = fromZonedTime(`${newEvent.revealDate}T${newEvent.revealTime}:00`, eventTz);
                            
                            return formatInTimeZone(revealUtc, spainTz, "dd/MM/yyyy HH:mm");
                          } catch {
                            return "";
                          }
                        })()}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Fecha de caducidad (opcional)</Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Después de esta fecha, la galería no será accesible y mostrará un mensaje con el enlace indicado.
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiryDate">Fecha</Label>
                        <Input
                          id="expiryDate"
                          type="date"
                          value={newEvent.expiryDate}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, expiryDate: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="expiryRedirectUrl">URL de redirección</Label>
                        <Input
                          id="expiryRedirectUrl"
                          type="url"
                          value={newEvent.expiryRedirectUrl}
                          onChange={(e) =>
                            setNewEvent({ ...newEvent, expiryRedirectUrl: e.target.value })
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isCreating || uploadingImage}>
                    {uploadingImage
                      ? "Subiendo imagen..."
                      : isCreating 
                        ? (editingEvent ? "Actualizando..." : "Creando...") 
                        : (editingEvent ? "Actualizar Evento" : "Crear Evento")
                    }
                  </Button>
                </form>
              </div>
            </DialogContent>
          </Dialog>
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

              return (
                <Card key={event.id} className="p-6">
                  <div className="flex flex-col lg:flex-row items-start gap-6">
                    {/* QR Code Section */}
                    <div className="flex-shrink-0 space-y-2">
                      <div className="bg-white p-3 rounded-lg border border-border">
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
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-semibold text-foreground">
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
                        <p>
                          <span className="font-medium">Fotos añadidas:</span>{" "}
                          {photoCount}{event.max_photos ? ` / ${event.max_photos}` : ""}
                        </p>
                        {event.max_photos && (
                          <p>
                            <span className="font-medium">Máximo de fotos:</span>{" "}
                            {event.max_photos}
                          </p>
                        )}
                        {event.upload_start_time && event.upload_end_time && (
                          <>
                            <p>
                              <span className="font-medium">Período de subida:</span>{" "}
                              {formatInTimeZone(new Date(event.upload_start_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: es })} - {formatInTimeZone(new Date(event.upload_end_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: es })}
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
                              <p className="text-xs text-muted-foreground pl-4">
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
                          className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border"
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
                    <div className="flex lg:flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditEvent(event)}
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
    </div>
  );
};

export default EventManagement;
