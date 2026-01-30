import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Globe, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import FontSizeSelect, { FontSizeOption } from "@/components/FontSizeSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, FILTER_ORDER } from "@/lib/photoFilters";
import logoRevelao from "@/assets/logo-revelao.png";

const MIN_BACKGROUND_WIDTH = 1280;
const MIN_BACKGROUND_HEIGHT = 720;

const BACKGROUND_IMAGE_SIZES = {
  mobile: { width: 640, height: 360 },
  tablet: { width: 1024, height: 576 },
  desktop: { width: 1920, height: 1080 },
} as const;

const PublicDemoEventForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    // Contact info fields (required for public demo)
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    // Event fields
    name: "",
    password: "",
    adminPassword: "",
    uploadStartDate: "",
    uploadStartTime: "00:00",
    uploadEndDate: "",
    uploadEndTime: "23:59",
    revealDate: "",
    revealTime: "12:00",
    customImage: null as File | null,
    customImageUrl: "",
    backgroundImage: null as File | null,
    backgroundImageUrl: "",
    filterType: "none" as FilterType,
    fontFamily: "system" as EventFontFamily,
    fontSize: "text-3xl" as FontSizeOption,
    countryCode: "ES",
    timezone: "Europe/Madrid",
    language: "es",
    description: "",
    expiryDate: "",
    expiryTime: "23:59",
    expiryRedirectUrl: "",
    allowPhotoDeletion: true,
    showLegalText: false,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

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
    
    // Validate required admin password
    if (!formData.adminPassword.trim()) {
      toast({
        title: "Error",
        description: "La contraseña de administrador es obligatoria",
        variant: "destructive",
      });
      return;
    }

    // Validate contact fields
    if (!formData.contactName.trim() || !formData.contactEmail.trim() || !formData.contactPhone.trim()) {
      toast({
        title: "Error",
        description: "Todos los campos de contacto son obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.contactEmail)) {
      toast({
        title: "Error",
        description: "Por favor, introduce un email válido",
        variant: "destructive",
      });
      return;
    }

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

      // Create event with fixed 10 photo limit and is_demo = true
      const { data: newEvent, error } = await supabase.from("events").insert({
        name: formData.name,
        password_hash: formData.password,
        admin_password: formData.adminPassword,
        upload_start_time: uploadStartDateTime.toISOString(),
        upload_end_time: uploadEndDateTime.toISOString(),
        reveal_time: revealDateTime.toISOString(),
        max_photos: 10, // Fixed at 10 for public demo
        custom_image_url: customImageUrl,
        background_image_url: backgroundImageUrl,
        filter_type: formData.filterType,
        font_family: formData.fontFamily,
        font_size: formData.fontSize,
        is_demo: true, // All public demo events are demo events
        country_code: formData.countryCode,
        timezone: formData.timezone,
        language: formData.language,
        description: formData.description || null,
        expiry_date: expiryDateTime,
        expiry_redirect_url: formData.expiryRedirectUrl || null,
        allow_photo_deletion: formData.allowPhotoDeletion,
        show_legal_text: formData.showLegalText,
      } as any).select().single();

      if (error) throw error;

      // Navigate to summary page with event data
      navigate("/nuevoeventodemo/resumen", { 
        state: { 
          event: newEvent,
          contactInfo: {
            name: formData.contactName,
            email: formData.contactEmail,
            phone: formData.contactPhone,
          }
        } 
      });

    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el evento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col items-center gap-4 mb-6">
          <img 
            src={logoRevelao} 
            alt="Revelao.com" 
            className="w-48 h-auto"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            Crea tu evento de prueba
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            Crea un evento gratuito con hasta 10 fotos para probar Revelao
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information Section */}
              <div className="space-y-4 border-b border-border pb-6">
                <Label className="text-base font-semibold">Información de contacto</Label>
                <p className="text-xs text-muted-foreground">
                  Necesitamos tus datos para poder contactarte si tienes algún problema con tu evento
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nombre completo *</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    required
                    placeholder="Tu nombre"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    required
                    placeholder="tu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Teléfono *</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    required
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              {/* Location & Language */}
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
                  onChange={(language) => setFormData({ ...formData, language })}
                />
                <p className="text-xs text-muted-foreground">
                  Las pantallas del evento se mostrarán en este idioma
                </p>
              </div>

              {/* Event Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del evento *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Font Settings */}
              <div className="space-y-2">
                <Label>Tipografía del nombre</Label>
                <FontSelect
                  value={formData.fontFamily}
                  onChange={(fontFamily) => setFormData({ ...formData, fontFamily })}
                  previewText={formData.name || "Nombre del evento"}
                />
              </div>

              <div className="space-y-2">
                <Label>Tamaño del nombre</Label>
                <FontSizeSelect
                  value={formData.fontSize}
                  onChange={(fontSize) => setFormData({ ...formData, fontSize })}
                  previewText={formData.name || "Nombre del evento"}
                  fontFamily={getEventFontFamily(formData.fontFamily)}
                />
              </div>

              {/* Passwords */}
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña del evento *</Label>
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Los invitados usarán esta contraseña para acceder al evento
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPassword">Contraseña de administrador *</Label>
                <Input
                  id="adminPassword"
                  type="text"
                  value={formData.adminPassword}
                  onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  required
                  className="border-primary/50"
                />
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Esta contraseña es obligatoria. La necesitarás para ver y administrar tu evento en acceso.revelao.cam
                </p>
              </div>

              {/* Fixed Photo Limit - Read Only */}
              <div className="space-y-2">
                <Label htmlFor="maxPhotos">Máximo de fotos</Label>
                <Input
                  id="maxPhotos"
                  type="number"
                  value="10"
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Los eventos de prueba están limitados a 10 fotos
                </p>
              </div>

              {/* Filter Type */}
              <div className="space-y-2">
                <Label htmlFor="filterType">Filtro de fotos</Label>
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

              {/* Custom Image */}
              <div className="space-y-2">
                <Label htmlFor="customImage">Imagen personalizada (opcional)</Label>
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

              {/* Background Image */}
              <div className="space-y-2">
                <Label htmlFor="backgroundImage">Fotografía de fondo (opcional)</Label>
                <div className="text-xs text-muted-foreground mb-2 space-y-1">
                  <p>Imagen que aparecerá como fondo en la cabecera de la galería.</p>
                  <p className="font-medium">Tamaño mínimo requerido: {MIN_BACKGROUND_WIDTH}×{MIN_BACKGROUND_HEIGHT}px (ratio 16:9)</p>
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
                      const img = new Image();
                      img.onload = () => {
                        URL.revokeObjectURL(img.src);
                        if (img.width < MIN_BACKGROUND_WIDTH || img.height < MIN_BACKGROUND_HEIGHT) {
                          toast({
                            title: "Imagen demasiado pequeña",
                            description: `La imagen debe ser al menos ${MIN_BACKGROUND_WIDTH}×${MIN_BACKGROUND_HEIGHT}px.`,
                            variant: "destructive",
                          });
                          e.target.value = '';
                          return;
                        }
                        const aspectRatio = img.width / img.height;
                        const targetRatio = 16 / 9;
                        if (Math.abs(aspectRatio - targetRatio) > 0.3) {
                          toast({
                            title: "Ratio de imagen incorrecto",
                            description: "La imagen debe tener un ratio aproximado de 16:9.",
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

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción breve del evento"
                  rows={3}
                />
              </div>

              {/* Upload Period */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Período de subida de fotos</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uploadStartDate">Fecha inicio</Label>
                    <Input
                      id="uploadStartDate"
                      type="date"
                      value={formData.uploadStartDate}
                      onChange={(e) => setFormData({ ...formData, uploadStartDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uploadStartTime">Hora inicio</Label>
                    <Input
                      id="uploadStartTime"
                      type="time"
                      value={formData.uploadStartTime}
                      onChange={(e) => setFormData({ ...formData, uploadStartTime: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, uploadEndDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uploadEndTime">Hora fin</Label>
                    <Input
                      id="uploadEndTime"
                      type="time"
                      value={formData.uploadEndTime}
                      onChange={(e) => setFormData({ ...formData, uploadEndTime: e.target.value })}
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

              {/* Reveal Date */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Fecha de revelado</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="revealDate">Fecha</Label>
                    <Input
                      id="revealDate"
                      type="date"
                      value={formData.revealDate}
                      onChange={(e) => setFormData({ ...formData, revealDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revealTime">Hora</Label>
                    <Input
                      id="revealTime"
                      type="time"
                      value={formData.revealTime}
                      onChange={(e) => setFormData({ ...formData, revealTime: e.target.value })}
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

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Fecha de caducidad (opcional)</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  Después de esta fecha, la galería no será accesible.
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiryDate">Fecha</Label>
                      <Input
                        id="expiryDate"
                        type="date"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expiryTime">Hora</Label>
                      <Input
                        id="expiryTime"
                        type="time"
                        value={formData.expiryTime}
                        onChange={(e) => setFormData({ ...formData, expiryTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryRedirectUrl">URL de redirección</Label>
                    <Input
                      id="expiryRedirectUrl"
                      type="url"
                      value={formData.expiryRedirectUrl}
                      onChange={(e) => setFormData({ ...formData, expiryRedirectUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-4 border-t border-border pt-4">
                <Label className="text-base font-semibold">Opciones adicionales</Label>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowPhotoDeletion">Posibilidad de eliminar fotos</Label>
                    <p className="text-xs text-muted-foreground">
                      Si está activado, los usuarios podrán eliminar fotos
                    </p>
                  </div>
                  <Switch
                    id="allowPhotoDeletion"
                    checked={formData.allowPhotoDeletion}
                    onCheckedChange={(checked) => setFormData({ ...formData, allowPhotoDeletion: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showLegalText">Añadir texto legal</Label>
                    <p className="text-xs text-muted-foreground">
                      Mostrará texto de aceptación de Términos y Privacidad
                    </p>
                  </div>
                  <Switch
                    id="showLegalText"
                    checked={formData.showLegalText}
                    onCheckedChange={(checked) => setFormData({ ...formData, showLegalText: checked })}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button type="submit" className="w-full" disabled={isSubmitting || uploadingImage}>
                  {uploadingImage ? "Subiendo imagen..." : isSubmitting ? "Creando evento..." : "Crear evento de prueba"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Preview Column */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <Card className="p-4">
                <EventPreview
                  eventName={formData.name}
                  description={formData.description}
                  fontFamily={formData.fontFamily}
                  fontSize={formData.fontSize}
                  backgroundImageUrl={
                    formData.backgroundImage 
                      ? URL.createObjectURL(formData.backgroundImage) 
                      : formData.backgroundImageUrl || undefined
                  }
                  customImageUrl={
                    formData.customImage 
                      ? URL.createObjectURL(formData.customImage) 
                      : formData.customImageUrl || undefined
                  }
                  filterType={formData.filterType}
                  language={formData.language}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicDemoEventForm;
