import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Globe, Trash2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, FILTER_ORDER } from "@/lib/photoFilters";

const MIN_BACKGROUND_WIDTH = 1280;
const MIN_BACKGROUND_HEIGHT = 720;

const BACKGROUND_IMAGE_SIZES = {
  mobile: { width: 640, height: 360 },
  tablet: { width: 1024, height: 576 },
  desktop: { width: 1920, height: 1080 },
} as const;

// Generate a simple 8-character hash
const generateHash = (): string => {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 4);
};

const PublicDemoEventForm = () => {
  const [currentStep, setCurrentStep] = useState(1); // Step 1 or 2
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Event info
    name: "",
    fontFamily: "system" as EventFontFamily,
    filterType: "none" as FilterType,
    customImage: null as File | null,
    customImageUrl: "",
    backgroundImage: null as File | null,
    backgroundImageUrl: "",
    description: "",
    uploadStartDate: "",
    uploadStartTime: "00:00",
    uploadEndDate: "",
    uploadEndTime: "23:59",
    revealDate: "",
    revealTime: "12:00",
    countryCode: "ES",
    timezone: "Europe/Madrid",
    language: "es",
    // Step 2: Contact info
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    // Auto-generated, never shown
    password: "",
    adminPassword: "",
  });

  // Auto-generate passwords when component mounts
  const generatedPasswords = useMemo(() => ({
    password: generateHash(),
    adminPassword: generateHash(),
  }), []);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Initialize passwords on mount
  useState(() => {
    setFormData(prev => ({
      ...prev,
      password: generatedPasswords.password,
      adminPassword: generatedPasswords.adminPassword,
    }));
  });


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

  const handleStepChange = (step: number) => {
    if (step === 1) {
      // Going back to step 1
      setCurrentStep(step);
    } else if (step === 2) {
      // Validating Step 1 before going to Step 2
      if (!formData.name.trim()) {
        toast({
          title: "Error",
          description: "El nombre del evento es obligatorio",
          variant: "destructive",
        });
        return;
      }
      if (!formData.uploadStartDate || !formData.uploadEndDate || !formData.revealDate) {
        toast({
          title: "Error",
          description: "Las fechas de inicio, fin y revelado son obligatorias",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(step);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate Step 2 - contact fields
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
        font_size: "text-3xl", // Fixed at M
        is_demo: true, // All public demo events are demo events
        country_code: formData.countryCode,
        timezone: formData.timezone,
        language: formData.language,
        description: formData.description || null,
        expiry_date: null,
        expiry_redirect_url: null,
        allow_photo_deletion: true, // Always true
        show_legal_text: false, // Always false
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
        <div className="flex flex-col items-center gap-2 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            Crea tu evento de prueba
          </h1>
          <p className="text-muted-foreground text-center max-w-md text-sm">
            Crea un evento gratuito con hasta 10 fotos para probar Revelao
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          <Card className="p-6">
            <form onSubmit={currentStep === 2 ? handleSubmit : (e) => { e.preventDefault(); handleStepChange(2); }} className="space-y-6">
              {/* Step 1: Event Information */}
              {currentStep === 1 && (
                <>
                  {/* Event Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del evento *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Ej: Boda María y Juan"
                    />
                  </div>

                  {/* Font Settings */}
                  <div className="space-y-2">
                    <Label>Tipografía *</Label>
                    <FontSelect
                      value={formData.fontFamily}
                      onChange={(fontFamily) => setFormData({ ...formData, fontFamily })}
                      previewText={formData.name || "Nombre del evento"}
                    />
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

                  {/* Background Image */}
                  <div className="space-y-2">
                    <Label htmlFor="backgroundImage">Fotografía de fondo (opcional)</Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      <p>Imagen que aparecerá como fondo en la cabecera de la galería.</p>
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
                          setFormData({ ...formData, backgroundImage: file });
                        }
                      }}
                    />
                  </div>

                  {/* Custom Image - Renamed to Logo Personalizado */}
                  <div className="space-y-2">
                    <Label htmlFor="customImage">Logo personalizado (opcional)</Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Se muestra como icono en las pantallas.
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

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción del evento (opcional)</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Cuéntanos sobre tu evento"
                      rows={3}
                    />
                  </div>

                  {/* Upload Period */}
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Período de subida de fotos</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="uploadStartDate">Fecha de inicio *</Label>
                        <Input
                          id="uploadStartDate"
                          type="date"
                          value={formData.uploadStartDate}
                          onChange={(e) => setFormData({ ...formData, uploadStartDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uploadStartTime">Hora de inicio *</Label>
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
                        <Label htmlFor="uploadEndDate">Fecha fin *</Label>
                        <Input
                          id="uploadEndDate"
                          type="date"
                          value={formData.uploadEndDate}
                          onChange={(e) => setFormData({ ...formData, uploadEndDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uploadEndTime">Hora fin *</Label>
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
                        <Label htmlFor="revealDate">Fecha *</Label>
                        <Input
                          id="revealDate"
                          type="date"
                          value={formData.revealDate}
                          onChange={(e) => setFormData({ ...formData, revealDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="revealTime">Hora *</Label>
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

                  {/* Location & Language - At the end of Step 1 */}
                  <div className="space-y-4 border-t border-border pt-6">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        ¿Dónde es el evento? *
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
                      <Label>Idioma del evento *</Label>
                      <LanguageSelect
                        value={formData.language as Language}
                        onChange={(language) => setFormData({ ...formData, language })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Las pantallas del evento se mostrarán en este idioma
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Contact Information */}
              {currentStep === 2 && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStepChange(1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-lg font-semibold">Información de contacto</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
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
                </>
              )}

              {/* Buttons */}
              <div className="pt-4 flex gap-3">
                {currentStep === 2 && (
                  <Button 
                    type="button"
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleStepChange(1)}
                  >
                    Atrás
                  </Button>
                )}
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isSubmitting || uploadingImage}
                >
                  {uploadingImage ? "Subiendo imagen..." : isSubmitting ? "Creando evento..." : currentStep === 1 ? "Siguiente" : "Crear evento de prueba"}
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
                  fontSize="text-3xl"
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
