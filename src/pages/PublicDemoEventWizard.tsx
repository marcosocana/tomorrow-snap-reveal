import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Asterisk, CalendarClock, Check, ImagePlus, Trash2, Zap } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { addDays, addMinutes, format, subMinutes } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import { Language } from "@/lib/translations";
import { EventFontFamily, FONT_OPTIONS, getFontById, loadGoogleFont } from "@/lib/eventFonts";
import { FilterType, FILTER_LABELS, FILTER_ORDER, getFilterClass } from "@/lib/photoFilters";
import weddingPreview from "@/assets/testimonial-wedding.jpg";

type StepId = "name" | "place" | "upload" | "reveal" | "style" | "contact";
type DemoTiming = "now" | "scheduled";

const steps: Array<{ id: StepId; label: string }> = [
  { id: "name", label: "Evento" },
  { id: "place", label: "Lugar" },
  { id: "upload", label: "Fotos" },
  { id: "reveal", label: "Revelado" },
  { id: "style", label: "Estilo" },
  { id: "contact", label: "Contacto" },
];

const REVELAO_RED = "#f06a5f";
const DEFAULT_LOGO_URL = "/LogoMiniRevelao.svg";
const dateInputClass =
  "h-9 min-w-0 rounded px-1.5 text-[14px] sm:h-12 sm:rounded-full sm:px-4 sm:text-base [appearance:textfield] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none";
const timeInputClass =
  "h-9 min-w-0 rounded px-1.5 text-[14px] sm:h-12 sm:rounded-full sm:px-4 sm:text-base [appearance:textfield] [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none";

const RequiredMark = () => (
  <Asterisk className="h-3.5 w-3.5 text-[#f06a5f]" aria-hidden="true" />
);

const generateHash = (): string =>
  Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 4);

const today = new Date();

const PublicDemoEventWizard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const generatedEventPassword = useMemo(generateHash, []);
  const [stepIndex, setStepIndex] = useState(0);
  const [demoTiming, setDemoTiming] = useState<DemoTiming | null>(null);
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
    password: "",
    passwordConfirm: "",
  });

  const currentStep = steps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const backgroundPreview = formData.backgroundImage ? URL.createObjectURL(formData.backgroundImage) : undefined;
  const selectedFont = getFontById(formData.fontFamily);
  const passwordTooShort = formData.password.length > 0 && formData.password.length < 8;
  const selectTryNow = () => {
    const now = new Date();
    const suggestedReveal = addMinutes(now, 31);
    suggestedReveal.setSeconds(0, 0);
    const suggestedUploadEnd = subMinutes(suggestedReveal, 1);
    setFormData((previous) => ({
      ...previous,
      uploadStartDate: formatInTimeZone(now, previous.timezone, "yyyy-MM-dd"),
      uploadStartTime: formatInTimeZone(now, previous.timezone, "HH:mm"),
      uploadEndDate: formatInTimeZone(suggestedUploadEnd, previous.timezone, "yyyy-MM-dd"),
      uploadEndTime: formatInTimeZone(suggestedUploadEnd, previous.timezone, "HH:mm"),
      revealDate: formatInTimeZone(suggestedReveal, previous.timezone, "yyyy-MM-dd"),
      revealTime: formatInTimeZone(suggestedReveal, previous.timezone, "HH:mm"),
    }));
    setDemoTiming("now");
  };

  useEffect(() => {
    FONT_OPTIONS.forEach((font) => {
      if (font.googleFont) {
        loadGoogleFont(font);
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyAuthenticatedUser = (email: string) => {
      if (!mounted) return;
      if (email) {
        setFormData((previous) => previous.contactEmail ? previous : { ...previous, contactEmail: email });
      }
    };

    const syncAuthenticatedUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      applyAuthenticatedUser(session?.user.email?.trim().toLowerCase() || "");
    };

    void syncAuthenticatedUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthenticatedUser(session?.user.email?.trim().toLowerCase() || "");
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
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
      if (!demoTiming) {
        showError("Elige si quieres probar la demo ahora o programarla.");
        return false;
      }
      if (demoTiming === "now") return true;
      if (!formData.uploadStartDate || !formData.uploadStartTime || !formData.uploadEndDate || !formData.uploadEndTime) {
        showError("Indica cuándo se podrán subir fotos.");
        return false;
      }
      const start = fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, formData.timezone);
      const end = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, formData.timezone);
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
      const reveal = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, formData.timezone);
      if (demoTiming === "now") {
        if (reveal <= addMinutes(new Date(), 1)) {
          showError("Elige un revelado con al menos unos minutos de margen para poder probar la subida de contenido.");
          return false;
        }
        return true;
      }
      const uploadEnd = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, formData.timezone);
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
      if (formData.password.length < 8) {
        showError("La contraseña debe contener al menos 8 dígitos.");
        return false;
      }
      if (formData.password !== formData.passwordConfirm) {
        showError("Las contraseñas no coinciden.");
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
      if (demoTiming === "now") return true;
      if (demoTiming !== "scheduled") return false;
      if (!formData.uploadStartDate || !formData.uploadStartTime || !formData.uploadEndDate || !formData.uploadEndTime) return false;
      return fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, formData.timezone) >
        fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, formData.timezone);
    }
    if (step === "reveal") {
      if (!formData.revealDate || !formData.revealTime) return false;
      const reveal = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, formData.timezone);
      if (demoTiming === "now") return reveal > addMinutes(new Date(), 1);
      const uploadEnd = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, formData.timezone);
      return reveal >= uploadEnd;
    }
    if (step === "style") return !!formData.fontFamily && !!formData.filterType && !!formData.backgroundImage;
    if (step === "contact") {
      return (
        !!formData.contactName.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail.trim()) &&
        !!formData.contactPhone.trim() &&
        formData.password.length >= 8 &&
        formData.password === formData.passwordConfirm
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

  const generateQrBlob = async (eventUrl: string): Promise<Blob | null> => {
    try {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const qrSize = 1024;
      const { createRoot } = await import("react-dom/client");
      const root = createRoot(container);

      await new Promise<void>((resolve) => {
        root.render(<QRCodeSVG value={eventUrl} size={qrSize} level="H" includeMargin />);
        window.setTimeout(resolve, 100);
      });

      const svgElement = container.querySelector("svg");
      if (!svgElement) throw new Error("QR_SVG_NOT_FOUND");

      const canvas = document.createElement("canvas");
      canvas.width = qrSize;
      canvas.height = qrSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("QR_CANVAS_NOT_FOUND");

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      const blob = await new Promise<Blob | null>((resolve) => {
        const image = new Image();
        image.onload = () => {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0);
          URL.revokeObjectURL(svgUrl);
          canvas.toBlob((result) => resolve(result), "image/png");
        };
        image.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          resolve(null);
        };
        image.src = svgUrl;
      });

      root.unmount();
      document.body.removeChild(container);
      return blob;
    } catch (error) {
      console.error("Error generating demo QR:", error);
      return null;
    }
  };

  const uploadQrImage = async (eventUrl: string, eventId: string) => {
    const qrBlob = await generateQrBlob(eventUrl);
    if (!qrBlob) return null;

    try {
      const filePath = `event-qr/qr-${eventId}.png`;
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(filePath, qrBlob, {
          contentType: "image/png",
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) throw uploadError;

      return supabase.storage.from("event-photos").getPublicUrl(filePath).data.publicUrl;
    } catch (error) {
      console.error("Error uploading demo QR:", error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep("reveal")) {
      setStepIndex(revealStepIndex);
      return;
    }
    if (!validateStep("contact")) return;
    setIsSubmitting(true);
    try {
      const eventTz = formData.timezone;
      const revealDateTime = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, eventTz);
      const uploadStartDateTime = demoTiming === "now"
        ? new Date()
        : fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, eventTz);
      const uploadEndDateTime = demoTiming === "now"
        ? subMinutes(revealDateTime, 1)
        : fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, eventTz);
      const customImageUrl = DEFAULT_LOGO_URL;
      const backgroundImageUrl = formData.backgroundImage ? await handleImageUpload(formData.backgroundImage) : "";
      const normalizedContactEmail = formData.contactEmail.trim().toLowerCase();
      const managementPassword = formData.password;

      const { data: createResult, error: createError } = await supabase.functions.invoke("create-demo-event", {
        body: {
          contactName: formData.contactName.trim(),
          contactEmail: normalizedContactEmail,
          password: managementPassword,
          phone: formData.contactPhone.trim(),
          marketingConsent: true,
          event: {
            name: formData.name.trim(),
            password_hash: generatedEventPassword,
            admin_password: managementPassword,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: 10,
            allow_video_recording: true,
            max_videos: 1,
            max_video_duration: 15,
            allow_audio_recording: true,
            max_audios: 3,
            max_audio_duration: 30,
            custom_image_url: customImageUrl,
            background_image_url: backgroundImageUrl || null,
            filter_type: formData.filterType,
            font_family: formData.fontFamily,
            font_size: "text-3xl",
            country_code: formData.countryCode,
            timezone: formData.timezone,
            language: formData.language,
            description: formData.description.trim() || null,
          },
        },
      });

      if (createError || createResult?.error || !createResult?.event) {
        let errorCode = createResult?.error || "";
        const errorContext = (createError as { context?: Response } | null)?.context;
        if (!errorCode && errorContext) {
          try {
            const errorBody = await errorContext.clone().json() as { error?: string };
            errorCode = errorBody.error || "";
          } catch {
            // Fall back to the SDK error message below.
          }
        }
        throw new Error(errorCode || createError?.message || "CREATE_EVENT_FAILED");
      }
      const newEvent = createResult.event;

      const eventUrl = `https://acceso.revelao.cam/events/${newEvent.password_hash}`;
      const qrUrl = await uploadQrImage(eventUrl, newEvent.id);
      const eventForSummary = qrUrl
        ? {
            ...newEvent,
            limits_json: {
              ...((newEvent.limits_json || {}) as Record<string, unknown>),
              qr_image_url: qrUrl,
            },
          }
        : newEvent;

      if (qrUrl) {
        localStorage.setItem(`event-qr-url-${newEvent.id}`, qrUrl);
        await supabase
          .from("events")
          .update({ limits_json: eventForSummary.limits_json })
          .eq("id", newEvent.id);
      }

      navigate("/nuevoeventodemo/resumen", {
        state: {
          event: eventForSummary,
          qrUrl,
          contactInfo: {
            name: formData.contactName.trim(),
            email: formData.contactEmail.trim(),
            phone: formData.contactPhone.trim(),
          },
        },
      });
    } catch (error) {
      console.error("Error creating demo event:", error);
      const errorCode = error instanceof Error ? error.message : "";
      const hasInvalidCredentials = errorCode.includes("INVALID_CREDENTIALS");
      toast({
        title: hasInvalidCredentials ? "Este usuario ya existe" : "Error",
        description: hasInvalidCredentials ? (
          <>
            Este usuario ya existe y tiene otra contraseña. Introduce la contraseña correcta o{" "}
            <a
              href="https://acceso.revelao.cam/reset-password"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              recupérala
            </a>
            .
          </>
        ) : (
          "No se pudo crear el evento."
        ),
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
                placeholder={'Por ejemplo: "¡Bienvenidos a nuestra boda!"'}
                rows={4}
                className="min-h-28 rounded-2xl px-4 py-3 text-base leading-relaxed"
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
            <div className="space-y-3">
              <div>
                <p className="font-medium text-foreground">¿Cómo quieres probar la demo?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Puedes empezar ahora mismo o dejarla programada para más adelante.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={selectTryNow}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    demoTiming === "now"
                      ? "border-[#f06a5f] bg-[#f06a5f]/10"
                      : "border-border bg-background hover:border-[#f06a5f]/60"
                  }`}
                >
                  <Zap className="mb-3 h-5 w-5 text-[#f06a5f]" />
                  <span className="block font-semibold">Probar ahora</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Empieza al crear la demo y sube contenido hasta un minuto antes del revelado.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTiming("scheduled")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    demoTiming === "scheduled"
                      ? "border-[#f06a5f] bg-[#f06a5f]/10"
                      : "border-border bg-background hover:border-[#f06a5f]/60"
                  }`}
                >
                  <CalendarClock className="mb-3 h-5 w-5 text-[#f06a5f]" />
                  <span className="block font-semibold">Programar la demo</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Elige las fechas y horas de inicio y fin de la subida.
                  </span>
                </button>
              </div>
            </div>
            {demoTiming === "scheduled" ? (
              <>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <Label htmlFor="uploadStartDate" className="flex items-center gap-1.5">
                  Empieza
                  <RequiredMark />
                </Label>
                <Label htmlFor="uploadStartTime" className="flex items-center gap-1.5">
                  Hora
                  <RequiredMark />
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <Input id="uploadStartDate" type="date" value={formData.uploadStartDate} onChange={(event) => update("uploadStartDate", event.target.value)} className={dateInputClass} />
                <Input id="uploadStartTime" type="time" value={formData.uploadStartTime} onChange={(event) => update("uploadStartTime", event.target.value)} className={timeInputClass} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <Label htmlFor="uploadEndDate" className="flex items-center gap-1.5">
                  Termina
                  <RequiredMark />
                </Label>
                <Label htmlFor="uploadEndTime" className="flex items-center gap-1.5">
                  Hora
                  <RequiredMark />
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <Input id="uploadEndDate" type="date" value={formData.uploadEndDate} onChange={(event) => update("uploadEndDate", event.target.value)} className={dateInputClass} />
                <Input id="uploadEndTime" type="time" value={formData.uploadEndTime} onChange={(event) => update("uploadEndTime", event.target.value)} className={timeInputClass} />
              </div>
            </div>
            {formData.countryCode !== "ES" ? (
              <p className="text-xs text-muted-foreground">
                En España: {spainTime(formData.uploadStartDate, formData.uploadStartTime)} - {spainTime(formData.uploadEndDate, formData.uploadEndTime)}
              </p>
            ) : null}
              </>
            ) : null}
          </div>
        );
      case "reveal":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_78px] gap-1.5 sm:grid-cols-[minmax(0,1fr)_112px] sm:gap-3">
                <Label htmlFor="revealDate" className="flex items-center gap-1.5">
                  Fecha
                  <RequiredMark />
                </Label>
                <Label htmlFor="revealTime" className="flex items-center gap-1.5">
                  Hora
                  <RequiredMark />
                </Label>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_78px] gap-1.5 sm:grid-cols-[minmax(0,1fr)_112px] sm:gap-3">
                <Input id="revealDate" type="date" value={formData.revealDate} onChange={(event) => update("revealDate", event.target.value)} className={dateInputClass} />
                <Input id="revealTime" type="time" value={formData.revealTime} onChange={(event) => update("revealTime", event.target.value)} className={timeInputClass} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              En este momento se revelarán las fotos y quedarán visibles para todos desde el mismo código QR.
            </p>
            {demoTiming === "now" ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Te recomendamos elegir una hora próxima.</p>
                <p className="mt-1 text-amber-800">
                  Así podrás probar primero a hacer fotos, vídeos y audios y ver el resultado al poco rato, sin esperar demasiado. Podrás subir contenido hasta un minuto antes del revelado.
                </p>
              </div>
            ) : null}
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
              <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} placeholder="tu@email.com" className="h-12 rounded-full px-4 text-base" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone" className="flex items-center gap-1.5">
                Teléfono
                <RequiredMark />
              </Label>
              <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} placeholder="+34 600 000 000" className="h-12 rounded-full px-4 text-base" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-1.5">
                    Contraseña
                    <RequiredMark />
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(event) => update("password", event.target.value)}
                    placeholder="Mínimo 8 dígitos"
                    className={`h-12 rounded-full px-4 text-base ${passwordTooShort ? "border-destructive ring-1 ring-destructive focus-visible:ring-destructive" : ""}`}
                    autoComplete="new-password"
                    aria-invalid={passwordTooShort}
                    aria-describedby="password-requirement"
                    required
                  />
                  <p
                    id="password-requirement"
                    className={`text-sm ${passwordTooShort ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                  >
                    La contraseña debe contener al menos 8 dígitos.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm" className="flex items-center gap-1.5">
                    Repetir contraseña
                    <RequiredMark />
                  </Label>
                  <Input
                    id="passwordConfirm"
                    type="password"
                    value={formData.passwordConfirm}
                    onChange={(event) => update("passwordConfirm", event.target.value)}
                    placeholder="Repite la contraseña"
                    className="h-12 rounded-full px-4 text-base"
                    autoComplete="new-password"
                    required
                  />
                </div>
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
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:py-8">
        <section className="flex flex-1 flex-col">
          <div className="mb-5 space-y-3">
            <div className="flex justify-center sm:justify-start">
              <img src="/LogoTransparent.png" alt="Revelao" className="h-8 w-auto" />
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
            className="flex flex-1 flex-col pb-24 sm:pb-0"
            onSubmit={(event) => {
              event.preventDefault();
              if (stepIndex === steps.length - 1) handleSubmit();
              else goNext();
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

            <div className="fixed bottom-0 left-0 right-0 z-40 mt-5 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0">
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-14 flex-none rounded-full sm:w-auto sm:flex-1"
                  onClick={goBack}
                  disabled={stepIndex === 0 || isSubmitting || uploadingImage}
                  aria-label="Atrás"
                >
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Atrás</span>
                </Button>
                <Button
                  type="submit"
                  className="h-12 flex-1 rounded-full text-white hover:opacity-90"
                  style={{ backgroundColor: REVELAO_RED }}
                  disabled={!isStepComplete(currentStep.id) || isSubmitting || uploadingImage}
                >
                  {stepIndex === steps.length - 1 ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {uploadingImage || isSubmitting ? "Creando..." : "Crear demo"}
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

      </div>
    </main>
  );
};

export default PublicDemoEventWizard;
