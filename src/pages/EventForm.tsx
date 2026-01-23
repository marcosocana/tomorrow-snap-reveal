import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import { Language } from "@/lib/translations";
import { EventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, FILTER_ORDER } from "@/lib/photoFilters";

// Background image dimensions - responsive sizes
const BACKGROUND_IMAGE_SIZES = {
  mobile: { width: 640, height: 360 },
  tablet: { width: 1024, height: 576 },
  desktop: { width: 1920, height: 1080 },
} as const;

// We'll accept images that are at least this size (16:9 aspect ratio)
const MIN_BACKGROUND_WIDTH = 1280;
const MIN_BACKGROUND_HEIGHT = 720;

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

const EventForm = () => {
  const { eventId } = useParams<{ eventId?: string }>();
  const isEditing = !!eventId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    adminPassword: "",
    uploadStartDate: "",
    uploadStartTime: "00:00",
    uploadEndDate: "",
    uploadEndTime: "23:59",
    revealDate: "",
    revealTime: "12:00",
    maxPhotos: isDemoMode ? "30" : "",
    customImage: null as File | null,
    customImageUrl: "",
    backgroundImage: null as File | null,
    backgroundImageUrl: "",
    filterType: "none" as FilterType,
    fontFamily: "system" as EventFontFamily,
    countryCode: "ES",
    timezone: "Europe/Madrid",
    language: "es",
    description: "",
    expiryDate: "",
    expiryTime: "23:59",
    expiryRedirectUrl: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication - demo mode bypasses auth
    const checkAuth = async () => {
      if (isDemoMode) {
        if (isEditing) {
          loadEvent();
        } else {
          setIsLoading(false);
        }
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin-login");
        return;
      }
      if (isEditing) {
        loadEvent();
      } else {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, isDemoMode, isEditing, eventId]);

  const loadEvent = async () => {
    if (!eventId) return;
    
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (error) throw error;
      
      const event = data as Event;
      const eventTz = event.timezone || "Europe/Madrid";
      const uploadStartDate = event.upload_start_time ? toZonedTime(new Date(event.upload_start_time), eventTz) : new Date();
      const uploadEndDate = event.upload_end_time ? toZonedTime(new Date(event.upload_end_time), eventTz) : new Date();
      const revealDate = toZonedTime(new Date(event.reveal_time), eventTz);
      const expiryDate = event.expiry_date ? toZonedTime(new Date(event.expiry_date), eventTz) : null;
      
      setFormData({
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
        fontFamily: (event as any).font_family || "system",
        countryCode: event.country_code || "ES",
        timezone: event.timezone || "Europe/Madrid",
        language: event.language || "es",
        description: event.description || "",
        expiryDate: expiryDate ? format(expiryDate, "yyyy-MM-dd") : "",
        expiryTime: expiryDate ? format(expiryDate, "HH:mm") : "23:59",
        expiryRedirectUrl: event.expiry_redirect_url || "",
      });
    } catch (error) {
      console.error("Error loading event:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el evento",
        variant: "destructive",
      });
      navigate("/event-management");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const eventTz = formData.timezone;
      const uploadStartDateTime = fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, eventTz);
      const uploadEndDateTime = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, eventTz);
      const revealDateTime = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, eventTz);

      let customImageUrl = formData.customImageUrl;
      if (formData.customImage) {
        const uploadedUrl = await handleImageUpload(formData.customImage);
        if (uploadedUrl) {
          customImageUrl = uploadedUrl;
        }
      }

      let backgroundImageUrl = formData.backgroundImageUrl;
      if (formData.backgroundImage) {
        const uploadedUrl = await handleImageUpload(formData.backgroundImage);
        if (uploadedUrl) {
          backgroundImageUrl = uploadedUrl;
        }
      }

      const expiryDateTime = formData.expiryDate 
        ? fromZonedTime(`${formData.expiryDate}T${formData.expiryTime}:00`, eventTz).toISOString()
        : null;

      if (isEditing && eventId) {
        const { error } = await supabase
          .from("events")
          .update({
            name: formData.name,
            password_hash: formData.password,
            admin_password: formData.adminPassword || null,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: formData.maxPhotos ? parseInt(formData.maxPhotos) : null,
            custom_image_url: customImageUrl,
            background_image_url: backgroundImageUrl,
            filter_type: formData.filterType,
            font_family: formData.fontFamily,
            country_code: formData.countryCode,
            timezone: formData.timezone,
            language: formData.language,
            description: formData.description || null,
            expiry_date: expiryDateTime,
            expiry_redirect_url: formData.expiryRedirectUrl || null,
          } as any)
          .eq("id", eventId);

        if (error) throw error;

        toast({
          title: "Evento actualizado",
          description: "El evento se actualizó correctamente",
        });
      } else {
        const { error } = await supabase.from("events").insert({
          name: formData.name,
          password_hash: formData.password,
          admin_password: formData.adminPassword || null,
          upload_start_time: uploadStartDateTime.toISOString(),
          upload_end_time: uploadEndDateTime.toISOString(),
          reveal_time: revealDateTime.toISOString(),
          max_photos: formData.maxPhotos ? parseInt(formData.maxPhotos) : (isDemoMode ? 30 : null),
          custom_image_url: customImageUrl,
          background_image_url: backgroundImageUrl,
          filter_type: formData.filterType,
          font_family: formData.fontFamily,
          is_demo: isDemoMode,
          country_code: formData.countryCode,
          timezone: formData.timezone,
          language: formData.language,
          description: formData.description || null,
          expiry_date: expiryDateTime,
          expiry_redirect_url: formData.expiryRedirectUrl || null,
        } as any);

        if (error) throw error;

        toast({
          title: "Evento creado",
          description: "El evento se creó correctamente",
        });
      }

      navigate("/event-management");
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: isEditing ? "No se pudo actualizar el evento" : "No se pudo crear el evento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/event-management")}
            className="rounded-full"
            title="Volver al listado"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {isEditing ? "Editar Evento" : "Nuevo Evento"}
          </h1>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                ¿Dónde es el evento?
              </Label>
              <CountrySelect
                value={formData.countryCode}
                onChange={(countryCode, timezone) =>
                  setFormData({ ...formData, countryCode, timezone })
                }
              />
              <p className="text-xs text-muted-foreground">
                Las horas se ajustarán a la zona horaria del país seleccionado
              </p>
            </div>

            <div className="space-y-2">
              <Label>Idioma del evento</Label>
              <LanguageSelect
                value={formData.language as Language}
                onChange={(language) =>
                  setFormData({ ...formData, language })
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
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Tipografía del nombre</Label>
              <FontSelect
                value={formData.fontFamily}
                onChange={(fontFamily) =>
                  setFormData({ ...formData, fontFamily })
                }
                previewText={formData.name || "Nombre del evento"}
              />
              <p className="text-xs text-muted-foreground">
                La tipografía elegida se mostrará en todas las pantallas del evento
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña del evento</Label>
              <Input
                id="password"
                type="text"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
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
                value={formData.adminPassword}
                onChange={(e) =>
                  setFormData({ ...formData, adminPassword: e.target.value })
                }
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPhotos">
                Máximo de fotos permitido
              </Label>
              <Input
                id="maxPhotos"
                type="number"
                min="1"
                value={formData.maxPhotos}
                onChange={(e) =>
                  setFormData({ ...formData, maxPhotos: e.target.value })
                }
                placeholder={isDemoMode ? "30 por defecto en demo" : "Ilimitado si se deja vacío"}
              />
              {isDemoMode && (
                <p className="text-xs text-muted-foreground">
                  En modo demo el valor por defecto es 30 fotos, pero puedes modificarlo
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="filterType">
                Filtro de fotos
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FILTER_ORDER.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setFormData({ ...formData, filterType: filter })}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      formData.filterType === filter
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
              {formData.customImageUrl && !formData.customImage && (
                <div className="mb-2 relative inline-block">
                  <img 
                    src={formData.customImageUrl} 
                    alt="Preview" 
                    className="max-w-[240px] max-h-[100px] object-contain border border-border rounded"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setFormData({ ...formData, customImageUrl: "", customImage: null })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {formData.customImage && (
                <div className="mb-2 relative inline-block">
                  <img 
                    src={URL.createObjectURL(formData.customImage)} 
                    alt="Preview" 
                    className="max-w-[240px] max-h-[100px] object-contain border border-border rounded"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setFormData({ ...formData, customImage: null })}
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
                    setFormData({ ...formData, customImage: file });
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundImage">
                Fotografía de fondo (opcional)
              </Label>
              <div className="text-xs text-muted-foreground mb-2 space-y-1">
                <p>Imagen que aparecerá como fondo en la cabecera de la galería y las pantallas del evento.</p>
                <p className="font-medium">Tamaño mínimo requerido: {MIN_BACKGROUND_WIDTH}×{MIN_BACKGROUND_HEIGHT}px (ratio 16:9)</p>
                <p>Se escalará automáticamente según el dispositivo:</p>
                <ul className="list-disc list-inside text-muted-foreground/80">
                  <li>Móvil: {BACKGROUND_IMAGE_SIZES.mobile.width}×{BACKGROUND_IMAGE_SIZES.mobile.height}px</li>
                  <li>Tablet: {BACKGROUND_IMAGE_SIZES.tablet.width}×{BACKGROUND_IMAGE_SIZES.tablet.height}px</li>
                  <li>Escritorio: {BACKGROUND_IMAGE_SIZES.desktop.width}×{BACKGROUND_IMAGE_SIZES.desktop.height}px</li>
                </ul>
              </div>
              {formData.backgroundImageUrl && !formData.backgroundImage && (
                <div className="mb-2 relative inline-block">
                  <img 
                    src={formData.backgroundImageUrl} 
                    alt="Preview fondo" 
                    className="w-full max-w-[320px] aspect-video object-cover border border-border rounded"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setFormData({ ...formData, backgroundImageUrl: "", backgroundImage: null })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {formData.backgroundImage && (
                <div className="mb-2 relative inline-block">
                  <img 
                    src={URL.createObjectURL(formData.backgroundImage)} 
                    alt="Preview fondo" 
                    className="w-full max-w-[320px] aspect-video object-cover border border-border rounded"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => setFormData({ ...formData, backgroundImage: null })}
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
                    // Validate image dimensions
                    const img = new Image();
                    img.onload = () => {
                      URL.revokeObjectURL(img.src);
                      if (img.width < MIN_BACKGROUND_WIDTH || img.height < MIN_BACKGROUND_HEIGHT) {
                        toast({
                          title: "Imagen demasiado pequeña",
                          description: `La imagen debe ser al menos ${MIN_BACKGROUND_WIDTH}×${MIN_BACKGROUND_HEIGHT}px. Tu imagen es ${img.width}×${img.height}px.`,
                          variant: "destructive",
                        });
                        e.target.value = '';
                        return;
                      }
                      // Check aspect ratio (should be close to 16:9)
                      const aspectRatio = img.width / img.height;
                      const targetRatio = 16 / 9;
                      if (Math.abs(aspectRatio - targetRatio) > 0.3) {
                        toast({
                          title: "Ratio de imagen incorrecto",
                          description: "La imagen debe tener un ratio aproximado de 16:9 (panorámica horizontal).",
                          variant: "destructive",
                        });
                        e.target.value = '';
                        return;
                      }
                      setFormData({ ...formData, backgroundImage: file });
                    };
                    img.onerror = () => {
                      URL.revokeObjectURL(img.src);
                      toast({
                        title: "Error",
                        description: "No se pudo leer la imagen",
                        variant: "destructive",
                      });
                    };
                    img.src = URL.createObjectURL(file);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Descripción (opcional)
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción breve del evento. Puedes usar saltos de línea."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Los saltos de línea se mostrarán en las pantallas del evento
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Período de subida de fotos</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uploadStartDate">Fecha inicio</Label>
                  <Input
                    id="uploadStartDate"
                    type="date"
                    value={formData.uploadStartDate}
                    onChange={(e) =>
                      setFormData({ ...formData, uploadStartDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uploadStartTime">Hora inicio</Label>
                  <Input
                    id="uploadStartTime"
                    type="time"
                    value={formData.uploadStartTime}
                    onChange={(e) =>
                      setFormData({ ...formData, uploadStartTime: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uploadEndDate">Fecha fin</Label>
                  <Input
                    id="uploadEndDate"
                    type="date"
                    value={formData.uploadEndDate}
                    onChange={(e) =>
                      setFormData({ ...formData, uploadEndDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uploadEndTime">Hora fin</Label>
                  <Input
                    id="uploadEndTime"
                    type="time"
                    value={formData.uploadEndTime}
                    onChange={(e) =>
                      setFormData({ ...formData, uploadEndTime: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              {formData.countryCode !== "ES" && formData.uploadStartDate && formData.uploadEndDate && (
                <p className="text-xs text-muted-foreground">
                  🇪🇸 En España: {(() => {
                    try {
                      const eventTz = formData.timezone;
                      const spainTz = "Europe/Madrid";
                      
                      const startUtc = fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, eventTz);
                      const endUtc = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, eventTz);
                      
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
                    value={formData.revealDate}
                    onChange={(e) =>
                      setFormData({ ...formData, revealDate: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="revealTime">Hora</Label>
                  <Input
                    id="revealTime"
                    type="time"
                    value={formData.revealTime}
                    onChange={(e) =>
                      setFormData({ ...formData, revealTime: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              {formData.countryCode !== "ES" && formData.revealDate && (
                <p className="text-xs text-muted-foreground">
                  🇪🇸 En España: {(() => {
                    try {
                      const eventTz = formData.timezone;
                      const spainTz = "Europe/Madrid";
                      
                      const revealUtc = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, eventTz);
                      
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
                Después de esta fecha y hora, la galería no será accesible y mostrará un mensaje con el enlace indicado.
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Fecha</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData({ ...formData, expiryDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiryTime">Hora</Label>
                    <Input
                      id="expiryTime"
                      type="time"
                      value={formData.expiryTime}
                      onChange={(e) =>
                        setFormData({ ...formData, expiryTime: e.target.value })
                      }
                    />
                  </div>
                </div>
                {formData.countryCode !== "ES" && formData.expiryDate && (
                  <p className="text-xs text-muted-foreground">
                    🇪🇸 En España: {(() => {
                      try {
                        const eventTz = formData.timezone;
                        const spainTz = "Europe/Madrid";
                        
                        const expiryUtc = fromZonedTime(`${formData.expiryDate}T${formData.expiryTime}:00`, eventTz);
                        
                        return formatInTimeZone(expiryUtc, spainTz, "dd/MM/yyyy HH:mm");
                      } catch {
                        return "";
                      }
                    })()}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="expiryRedirectUrl">URL de redirección</Label>
                  <Input
                    id="expiryRedirectUrl"
                    type="url"
                    value={formData.expiryRedirectUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryRedirectUrl: e.target.value })
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/event-management")}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:flex-1" disabled={isSubmitting || uploadingImage}>
                {uploadingImage
                  ? "Subiendo imagen..."
                  : isSubmitting 
                    ? (isEditing ? "Actualizando..." : "Creando...") 
                    : (isEditing ? "Actualizar Evento" : "Crear Evento")
                }
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default EventForm;
