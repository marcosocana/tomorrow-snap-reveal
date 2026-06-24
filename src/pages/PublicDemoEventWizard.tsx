import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, ImagePlus, Sparkles, Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, FILTER_ORDER } from "@/lib/photoFilters";

type StepId = "name" | "place" | "upload" | "reveal" | "style" | "contact" | "review";

const steps: Array<{ id: StepId; label: string }> = [
  { id: "name", label: "Evento" },
  { id: "place", label: "Lugar" },
  { id: "upload", label: "Fotos" },
  { id: "reveal", label: "Revelado" },
  { id: "style", label: "Estilo" },
  { id: "contact", label: "Contacto" },
  { id: "review", label: "Revisión" },
];

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
    fontFamily: "system" as EventFontFamily,
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
  const logoPreview = formData.customImage ? URL.createObjectURL(formData.customImage) : undefined;

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
    return true;
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
      const customImageUrl = formData.customImage ? await handleImageUpload(formData.customImage) : "";
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
          custom_image_url: customImageUrl || null,
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
              <Label htmlFor="name">¿Cómo se llama el evento?</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="Ej: Boda María y Juan"
                autoFocus
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
            <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              La demo permite probar Revelao con hasta 10 fotos.
            </div>
          </div>
        );
      case "place":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>¿Dónde será?</Label>
              <CountrySelect
                value={formData.countryCode}
                onChange={(countryCode, timezone) =>
                  setFormData((prev) => ({ ...prev, countryCode, timezone }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Idioma del evento</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="uploadStartDate">Empieza</Label>
                <Input id="uploadStartDate" type="date" value={formData.uploadStartDate} onChange={(event) => update("uploadStartDate", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploadStartTime">Hora</Label>
                <Input id="uploadStartTime" type="time" value={formData.uploadStartTime} onChange={(event) => update("uploadStartTime", event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="uploadEndDate">Termina</Label>
                <Input id="uploadEndDate" type="date" value={formData.uploadEndDate} onChange={(event) => update("uploadEndDate", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploadEndTime">Hora</Label>
                <Input id="uploadEndTime" type="time" value={formData.uploadEndTime} onChange={(event) => update("uploadEndTime", event.target.value)} />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="revealDate">Fecha</Label>
                <Input id="revealDate" type="date" value={formData.revealDate} onChange={(event) => update("revealDate", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revealTime">Hora</Label>
                <Input id="revealTime" type="time" value={formData.revealTime} onChange={(event) => update("revealTime", event.target.value)} />
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              Hasta este momento, las fotos quedarán ocultas. Después se podrán ver en la galería.
            </div>
            {formData.countryCode !== "ES" ? (
              <p className="text-xs text-muted-foreground">En España: {spainTime(formData.revealDate, formData.revealTime)}</p>
            ) : null}
          </div>
        );
      case "style":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Tipografía</Label>
              <FontSelect
                value={formData.fontFamily}
                onChange={(fontFamily) => update("fontFamily", fontFamily)}
                previewText={formData.name || "Nombre del evento"}
              />
            </div>
            <div className="space-y-2">
              <Label>Filtro de fotos</Label>
              <div className="grid grid-cols-2 gap-2">
                {FILTER_ORDER.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => update("filterType", filter)}
                    className={`min-h-10 rounded-md border px-3 text-sm font-medium ${
                      formData.filterType === filter
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {FILTER_LABELS[filter]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm">
                <ImagePlus className="mb-2 h-5 w-5" />
                Fondo opcional
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => update("backgroundImage", event.target.files?.[0] || null)} />
              </label>
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm">
                <ImagePlus className="mb-2 h-5 w-5" />
                Logo opcional
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => update("customImage", event.target.files?.[0] || null)} />
              </label>
            </div>
            {(formData.backgroundImage || formData.customImage) ? (
              <div className="flex flex-wrap gap-2">
                {formData.backgroundImage ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => update("backgroundImage", null)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Quitar fondo
                  </Button>
                ) : null}
                {formData.customImage ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => update("customImage", null)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Quitar logo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      case "contact":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="contactName">Tu nombre</Label>
              <Input id="contactName" value={formData.contactName} onChange={(event) => update("contactName", event.target.value)} placeholder="Tu nombre" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} placeholder="tu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Teléfono</Label>
              <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} placeholder="+34 600 000 000" />
            </div>
          </div>
        );
      case "review":
        return (
          <div className="space-y-4">
            <div className="rounded-md border border-border p-4 text-sm">
              <p className="font-semibold text-foreground">{formData.name || "Evento demo"}</p>
              <p className="text-muted-foreground">Subida: {formData.uploadStartDate} {formData.uploadStartTime} - {formData.uploadEndDate} {formData.uploadEndTime}</p>
              <p className="text-muted-foreground">Revelado: {formData.revealDate} {formData.revealTime}</p>
              <p className="text-muted-foreground">Contacto: {formData.contactName} · {formData.contactEmail}</p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              Listo. Crearemos una demo gratuita limitada a 10 fotos.
            </div>
          </div>
        );
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:py-8">
        <section className="flex flex-1 flex-col">
          <div className="mb-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" />
              Demo Revelao
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                Crea tu evento de prueba
              </h1>
              <p className="text-sm text-muted-foreground">
                Paso {stepIndex + 1} de {steps.length}: {currentStep.label}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <form
            className="flex flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              currentStep.id === "review" ? handleSubmit() : goNext();
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
                  className="flex-1"
                  onClick={goBack}
                  disabled={stepIndex === 0 || isSubmitting || uploadingImage}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting || uploadingImage}>
                  {currentStep.id === "review" ? (
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
              customImageUrl={logoPreview}
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
