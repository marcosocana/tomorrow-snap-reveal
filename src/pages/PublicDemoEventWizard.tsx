import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Asterisk, CalendarDays, Check, Clock, ImagePlus, Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily, FONT_OPTIONS, getFontById, loadGoogleFont } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, FILTER_ORDER, getFilterClass } from "@/lib/photoFilters";
import weddingPreview from "@/assets/testimonial-wedding.jpg";

type StepId = "name" | "place" | "upload" | "reveal" | "style" | "contact";

const steps: Array<{ id: StepId; label: string }> = [
  { id: "name", label: "Evento" },
  { id: "place", label: "Lugar" },
  { id: "upload", label: "Fotos" },
  { id: "reveal", label: "Revelado" },
  { id: "style", label: "Estilo" },
  { id: "contact", label: "Contacto" },
];

const REVELAO_RED = "#f06a5f";
const DEFAULT_LOGO_URL = "/marca_revelao_qr_evento.png";
const inputPillClass = "h-12 min-w-0 rounded-full px-4 text-base [color-scheme:light]";

const RequiredMark = () => (
  <Asterisk className="h-3.5 w-3.5 text-[#f06a5f]" aria-hidden="true" />
);

const generateHash = (): string =>
  Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 4);

const today = new Date();

const PublicDemoEventWizard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const generatedPasswords = useMemo(
    () => ({
      password: generateHash(),
      adminPassword: generateHash(),
    }),
    [],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    countryCode: "ES",
    timezone: "Europe/Madrid",
    language: "es",
    uploadStartDate: format(today, "yyyy-MM-dd"),
    uploadStartTime: "10:00",
    uploadEndDate: format(addDays(today, 1), "yyyy-MM-dd"),
    uploadEndTime: "23:59",
    revealDate: format(addDays(today, 2), "yyyy-MM-dd"),
    revealTime: "12:00",
    fontFamily: "great-vibes" as EventFontFamily,
    filterType: "none" as FilterType,
    customImage: null as File | null,
    backgroundImage: null as File | null,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const currentStep = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const backgroundPreview = formData.backgroundImage ? URL.createObjectURL(formData.backgroundImage) : undefined;
  const selectedFont = getFontById(formData.fontFamily);

  useEffect(() => {
    FONT_OPTIONS.forEach((font) => {
      if (font.googleFont) {
        loadGoogleFont(font);
      }
    });
  }, []);

  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const showError = (description: string) => {
    toast({
      title: "Revisa este paso",
      description,
      variant: "destructive",
    });
  };

  const validateStep = (step: StepId) => {
    if (step === "name" && !formData.name.trim()) {
      showError("El nombre del evento es obligatorio.");
      return false;
    }
    if (step === "upload") {
      if (!formData.uploadStartDate || !formData.uploadStartTime || !formData.uploadEndDate || !formData.uploadEndTime) {
        showError("Indica cuándo se podrán subir fotos.");
        return false;
      }
      const start = new Date(`${formData.uploadStartDate}T${formData.uploadStartTime}`);
      const end = new Date(`${formData.uploadEndDate}T${formData.uploadEndTime}`);
      if (end <= start) {
        showError("La fecha final debe ser posterior a la fecha de inicio.");
        return false;
      }
    }
    if (step === "reveal") {
      if (!formData.revealDate || !formData.revealTime) {
        showError("Indica cuándo se revelarán las fotos.");
        return false;
      }
      const uploadEnd = new Date(`${formData.uploadEndDate}T${formData.uploadEndTime}`);
      const reveal = new Date(`${formData.revealDate}T${formData.revealTime}`);
      if (reveal < uploadEnd) {
        showError("El revelado debe ser después del periodo de subida.");
        return false;
      }
    }
    if (step === "contact") {
      if (!formData.contactName.trim() || !formData.contactEmail.trim() || !formData.contactPhone.trim()) {
        showError("Completa nombre, email y teléfono.");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim())) {
        showError("Introduce un email válido.");
        return false;
      }
    }
    if (step === "style" && !formData.backgroundImage) {
      showError("Sube una imagen de fondo para continuar.");
      return false;
    }
    return true;
  };

  const isStepComplete = (step: StepId) => {
    if (step === "name") return !!formData.name.trim();
    if (step === "place") return !!formData.countryCode && !!formData.language;
    if (step === "upload") {
      if (!formData.uploadStartDate || !formData.uploadStartTime || !formData.uploadEndDate || !formData.uploadEndTime) return false;
      return new Date(`${formData.uploadEndDate}T${formData.uploadEndTime}`) > new Date(`${formData.uploadStartDate}T${formData.uploadStartTime}`);
    }
    if (step === "reveal") {
      if (!formData.revealDate || !formData.revealTime) return false;
      return new Date(`${formData.revealDate}T${formData.revealTime}`) >= new Date(`${formData.uploadEndDate}T${formData.uploadEndTime}`);
    }
    if (step === "style") return !!formData.fontFamily && !!formData.filterType && !!formData.backgroundImage;
    if (step === "contact") {
      return (
        !!formData.contactName.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim()) &&
        !!formData.contactPhone.trim()
      );
    }
    return false;
  };

  const goNext = () => {
    if (!validateStep(currentStep.id)) return;
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `event-images/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      return supabase.storage.from("event-photos").getPublicUrl(filePath).data.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "No se pudo subir la imagen.",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep("contact")) return;
    setIsSubmitting(true);
    try {
      const eventTz = formData.timezone;
      const uploadStartDateTime = fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, eventTz);
      const uploadEndDateTime = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, eventTz);
      const revealDateTime = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, eventTz);
      const customImageUrl = DEFAULT_LOGO_URL;
      const backgroundImageUrl = formData.backgroundImage ? await handleImageUpload(formData.backgroundImage) : "";

      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          name: formData.name.trim(),
          password_hash: generatedPasswords.password,
          admin_password: generatedPasswords.adminPassword,
          upload_start_time: uploadStartDateTime.toISOString(),
          upload_end_time: uploadEndDateTime.toISOString(),
          reveal_time: revealDateTime.toISOString(),
          max_photos: 10,
          custom_image_url: customImageUrl,
          background_image_url: backgroundImageUrl || null,
          filter_type: formData.filterType,
          font_family: formData.fontFamily,
          font_size: "text-3xl",
          is_demo: true,
          country_code: formData.countryCode,
          timezone: formData.timezone,
          language: formData.language,
          description: formData.description.trim() || null,
          expiry_date: null,
          expiry_redirect_url: null,
          allow_photo_deletion: true,
          show_legal_text: false,
        } as any)
        .select()
        .single();

      if (error) throw error;

      navigate("/nuevoeventodemo/resumen", {
        state: {
          event: newEvent,
          contactInfo: {
            name: formData.contactName.trim(),
            email: formData.contactEmail.trim(),
            phone: formData.contactPhone.trim(),
          },
        },
      });
    } catch (error) {
      console.error("Error creating demo event:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el evento.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const spainTime = (date: string, time: string) => {
    try {
      return formatInTimeZone(fromZonedTime(`${date}T${time}:00`, formData.timezone), "Europe/Madrid", "dd/MM/yyyy HH:mm");
    } catch {
      return "";
    }
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case "name":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1.5">
                ¿Cómo se llama el evento?
                <RequiredMark />
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Ej: Boda María y Juan"
                autoFocus
                className="h-12 rounded-full px-4 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Añade una descripción breve</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Opcional, por ejemplo: fotos espontáneas durante la fiesta."
                rows={4}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Crearemos un espacio demo para que pruebes la experiencia Revelao antes de tu evento real.
            </p>
          </div>
        );
      case "place":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                ¿Dónde será?
                <RequiredMark />
              </Label>
              <CountrySelect
                value={formData.countryCode}
                onChange={(countryCode, timezone) =>
                  setFormData((prev) => ({ ...prev, countryCode, timezone }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Idioma del evento
                <RequiredMark />
              </Label>
              <LanguageSelect
                value={formData.language as Language}
                onChange={(language) => update("language", language)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Usaremos la zona horaria del país para calcular cuándo se puede subir y revelar el contenido.
            </p>
          </div>
        );
      case "upload":
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="uploadStartDate" className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Empieza
                  <RequiredMark />
                </Label>
                <Input id="uploadStartDate" type="date" value={formData.uploadStartDate} onChange={(event) => update("uploadStartDate", event.target.value)} className={inputPillClass} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploadStartTime" className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Hora
                  <RequiredMark />
                </Label>
                <Input id="uploadStartTime" type="time" value={formData.uploadStartTime} onChange={(event) => update("uploadStartTime", event.target.value)} className={inputPillClass} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="uploadEndDate" className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Termina
                  <RequiredMark />
                </Label>
                <Input id="uploadEndDate" type="date" value={formData.uploadEndDate} onChange={(event) => update("uploadEndDate", event.target.value)} className={inputPillClass} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploadEndTime" className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Hora
                  <RequiredMark />
                </Label>
                <Input id="uploadEndTime" type="time" value={formData.uploadEndTime} onChange={(event) => update("uploadEndTime", event.target.value)} className={inputPillClass} />
              </div>
            </div>
            {formData.countryCode !== "ES" ? (
              <p className="text-xs text-muted-foreground">
                En España: {spainTime(formData.uploadStartDate, formData.uploadStartTime)} - {spainTime(formData.uploadEndDate, formData.uploadEndTime)}
              </p>
            ) : null}
          </div>
        );
      case "reveal":
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="revealDate" className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Fecha
                  <RequiredMark />
                </Label>
                <Input id="revealDate" type="date" value={formData.revealDate} onChange={(event) => update("revealDate", event.target.value)} className={inputPillClass} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revealTime" className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Hora
                  <RequiredMark />
                </Label>
                <Input id="revealTime" type="time" value={formData.revealTime} onChange={(event) => update("revealTime", event.target.value)} className={inputPillClass} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Hasta este momento, las fotos quedarán ocultas. Después se podrán ver en la galería.
            </p>
            {formData.countryCode !== "ES" ? (
              <p className="text-xs text-muted-foreground">En España: {spainTime(formData.revealDate, formData.revealTime)}</p>
            ) : null}
          </div>
        );
      case "style":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fontFamily" className="flex items-center gap-1.5">
                Tipografía
                <RequiredMark />
              </Label>
              <select
                id="fontFamily"
                value={formData.fontFamily}
                onChange={(event) => update("fontFamily", event.target.value as EventFontFamily)}
                className="h-12 w-full rounded-full border border-input bg-background px-4 text-base"
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.name}
                  </option>
                ))}
              </select>
              <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
                <p
                  className="text-2xl text-foreground"
                  style={{ fontFamily: selectedFont.fontFamily }}
                >
                  {formData.name || "Nombre del evento"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Filtro de fotos
                <RequiredMark />
              </Label>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {FILTER_ORDER.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => update("filterType", filter)}
                    className={`w-32 shrink-0 overflow-hidden rounded-md border text-left transition-colors ${
                      formData.filterType === filter
                        ? "border-[#f06a5f] bg-[#f06a5f]/10"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <img
                        src={weddingPreview}
                        alt=""
                        className={`h-full w-full object-cover ${getFilterClass(filter)}`}
                      />
                    </div>
                    <span className="block px-2 py-2 text-xs font-medium">
                      {FILTER_LABELS[filter]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Imagen de fondo
                <RequiredMark />
              </Label>
              {backgroundPreview ? (
                <img
                  src={backgroundPreview}
                  alt="Vista previa del fondo"
                  className="aspect-video w-full rounded-md border border-border object-cover"
                />
              ) : null}
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm">
                <ImagePlus className="mb-2 h-5 w-5" />
                {formData.backgroundImage ? formData.backgroundImage.name : "Subir imagen de fondo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => update("backgroundImage", event.target.files?.[0] || null)} />
              </label>
            </div>
            {formData.backgroundImage ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => update("backgroundImage", null)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Quitar fondo
                </Button>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">
              El logo de Revelao aparecerá por defecto en esta demo.
            </p>
          </div>
        );
      case "contact":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="contactName" className="flex items-center gap-1.5">
                Tu nombre
                <RequiredMark />
              </Label>
              <Input id="contactName" value={formData.contactName} onChange={(event) => update("contactName", event.target.value)} placeholder="Tu nombre" className="h-12 rounded-full px-4 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
                Email
                <RequiredMark />
              </Label>
              <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} placeholder="tu@email.com" className="h-12 rounded-full px-4 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="flex items-center gap-1.5">
                Teléfono
                <RequiredMark />
              </Label>
              <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} placeholder="+34 600 000 000" className="h-12 rounded-full px-4 text-base" />
            </div>
            <p className="text-sm text-muted-foreground">
              Al crear la demo te llevaremos al resumen del evento con el enlace de acceso.
            </p>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:py-8">
        <section className="flex flex-1 flex-col">
          <div className="mb-5 space-y-3">
            <div className="flex justify-center sm:justify-start">
              <img src="/logo-revelao.png" alt="Revelao" className="h-7 w-auto" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                Crea tu evento de prueba
              </h1>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: REVELAO_RED }} />
            </div>
          </div>

          <form
            className="flex flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              currentStep.id === "contact" ? handleSubmit() : goNext();
            }}
          >
            <div className="flex-1 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {currentStep.label}
                </p>
              </div>
              {renderStep()}
            </div>

            <div className="sticky bottom-0 -mx-4 mt-5 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 flex-1 rounded-full"
                  onClick={goBack}
                  disabled={stepIndex === 0 || isSubmitting || uploadingImage}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                <Button
                  type="submit"
                  className="h-12 flex-1 rounded-full text-white hover:opacity-90"
                  style={{ backgroundColor: REVELAO_RED }}
                  disabled={!isStepComplete(currentStep.id) || isSubmitting || uploadingImage}
                >
                  {currentStep.id === "contact" ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {uploadingImage ? "Subiendo..." : isSubmitting ? "Creando..." : "Crear demo"}
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </section>

        <aside className="mt-6 hidden lg:block">
          <div className="sticky top-6 rounded-lg border border-border bg-card p-4">
            <EventPreview
              eventName={formData.name}
              description={formData.description}
              fontFamily={formData.fontFamily}
              fontSize="text-3xl"
              backgroundImageUrl={backgroundPreview}
              customImageUrl={DEFAULT_LOGO_URL}
              filterType={formData.filterType}
              language={formData.language}
            />
          </div>
        </aside>
      </div>
    </main>
  );
};

export default PublicDemoEventWizard;
