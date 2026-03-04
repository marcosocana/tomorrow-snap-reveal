import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimeField } from "@/components/DateTimeField";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { addDays, format, subHours } from "date-fns";
import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";
import { QRCodeSVG } from "qrcode.react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_ORDER, getFilterClass, getGrainClass } from "@/lib/photoFilters";
import logoDemo from "@/assets/Frame 626035.png";
import defaultQrLogo from "@/assets/Frame 626035.png";
import weddingPreview from "@/assets/testimonial-wedding.jpg";
import { useDemoI18n } from "@/lib/demoI18n";
import { getTimezoneOffset } from "@/lib/countries";

const generateHash = (): string => Math.random().toString(36).substring(2, 10);

const PublicDemoEventForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { lang, t, pathPrefix } = useDemoI18n();
  const [formData, setFormData] = useState(() => {
    const now = new Date();
    const currentTime = format(now, "HH:mm");

    return {
      // Contact info fields (required for public demo)
      contactEmail: "",
      contactPassword: "",
      contactPasswordConfirm: "",
      contactPhone: "",
      // Event fields
      name: "",
      password: generateHash(),
      adminPassword: generateHash(),
      uploadStartDate: format(now, "yyyy-MM-dd"),
      uploadStartTime: currentTime,
      uploadEndDate: format(addDays(now, 1), "yyyy-MM-dd"),
      uploadEndTime: currentTime,
      revealDate: format(addDays(now, 2), "yyyy-MM-dd"),
      revealTime: currentTime,
      customImage: null as File | null,
      customImageUrl: defaultQrLogo,
      backgroundImage: null as File | null,
      backgroundImageUrl: "",
      filterType: "none" as FilterType,
      fontFamily: "system" as EventFontFamily,
      fontSize: "text-3xl",
      countryCode: "ES",
      timezone: "Europe/Madrid",
      language: lang,
      description: "",
    };
  });
  const [startMode, setStartMode] = useState<"now" | "schedule">("now");
  const navigate = useNavigate();
  const { toast } = useToast();
  const now = new Date();
  const nowTz = toZonedTime(now, formData.timezone);
  const todayStr = format(nowTz, "yyyy-MM-dd");
  const nowTimeStr = format(nowTz, "HH:mm");
  const startMinTimeStr = format(subHours(nowTz, 2), "HH:mm");
  const formatTimezoneOffset = (timezone: string) => {
    const offsetMinutes = getTimezoneOffset(timezone);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const minutes = String(absMinutes % 60).padStart(2, "0");
    return `GMT${sign}${hours}:${minutes}`;
  };
  const timezoneOffsetLabel = formatTimezoneOffset(formData.timezone);

  const timeToMinutes = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };

  const maxTime = (...values: Array<string | null | undefined>) => {
    const times = values.filter(Boolean) as string[];
    if (times.length === 0) return undefined;
    return times.reduce((max, current) =>
      timeToMinutes(current) > timeToMinutes(max) ? current : max
    );
  };

  const maxDate = (...values: Array<string | null | undefined>) => {
    const dates = values.filter(Boolean) as string[];
    if (dates.length === 0) return undefined;
    return dates.reduce((max, current) => (current > max ? current : max));
  };

  const clampTime = (value: string, min?: string) => {
    if (!min) return value;
    return timeToMinutes(value) < timeToMinutes(min) ? min : value;
  };

  const getEffectiveStartDate = () =>
    startMode === "now" ? format(nowTz, "yyyy-MM-dd") : formData.uploadStartDate;
  const getEffectiveStartTime = () =>
    startMode === "now" ? format(nowTz, "HH:mm") : formData.uploadStartTime;
  const isStep1Complete = () => {
    const hasName = formData.name.trim().length > 0;
    const hasBackground = Boolean(formData.backgroundImage || formData.backgroundImageUrl);
    const hasStart = startMode === "now"
      ? true
      : Boolean(formData.uploadStartDate && formData.uploadStartTime);
    const hasEnd = Boolean(formData.uploadEndDate && formData.uploadEndTime);
    const hasReveal = Boolean(formData.revealDate && formData.revealTime);
    return hasName && hasBackground && hasStart && hasEnd && hasReveal;
  };
  const isStep2Complete = () => {
    const hasEmail = formData.contactEmail.trim().length > 0;
    const hasPassword = formData.contactPassword.trim().length > 0;
    const hasConfirm = formData.contactPasswordConfirm.trim().length > 0;
    return hasEmail && hasPassword && hasConfirm;
  };

  const getEndTimeMin = (overrideDate?: string) => {
    const date = overrideDate ?? formData.uploadEndDate;
    const startDate = getEffectiveStartDate();
    const startTime = getEffectiveStartTime();
    return maxTime(
      date === todayStr ? nowTimeStr : undefined,
      date === startDate ? startTime : undefined
    );
  };

  const getRevealTimeMin = (overrideDate?: string) => {
    const date = overrideDate ?? formData.revealDate;
    const startDate = getEffectiveStartDate();
    const startTime = getEffectiveStartTime();
    return maxTime(
      date === todayStr ? nowTimeStr : undefined,
      date === startDate ? startTime : undefined,
      date === formData.uploadEndDate ? formData.uploadEndTime : undefined
    );
  };

  const validateEventDates = () => {
    try {
      const eventTz = formData.timezone;
      const now = new Date();
      const startDate = getEffectiveStartDate();
      const startTime = getEffectiveStartTime();
      const startUtc = fromZonedTime(`${startDate}T${startTime}:00`, eventTz);
      const endUtc = fromZonedTime(`${formData.uploadEndDate}T${formData.uploadEndTime}:00`, eventTz);
      const revealUtc = fromZonedTime(`${formData.revealDate}T${formData.revealTime}:00`, eventTz);

      const nowTz = toZonedTime(now, eventTz);
      if (endUtc < now || endUtc < startUtc) return false;
      if (revealUtc < now || revealUtc < endUtc) return false;
      return true;
    } catch {
      return false;
    }
  };

  const generateQrBlob = async (eventUrl: string): Promise<Blob | null> => {
    try {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const qrSize = 1024;
      const qrWrapper = document.createElement("div");
      container.appendChild(qrWrapper);

      const { createRoot } = await import("react-dom/client");
      const root = createRoot(qrWrapper);

      await new Promise<void>((resolve) => {
        root.render(
          <QRCodeSVG value={eventUrl} size={qrSize} level="H" includeMargin />
        );
        setTimeout(resolve, 100);
      });

      const svgElement = qrWrapper.querySelector("svg");
      if (!svgElement) throw new Error("No se pudo generar el QR");

      const canvas = document.createElement("canvas");
      canvas.width = qrSize;
      canvas.height = qrSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo crear el canvas");

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const blob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob((result) => resolve(result), "image/png");
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });

      root.unmount();
      document.body.removeChild(container);
      return blob;
    } catch (error) {
      console.error("Error generating QR:", error);
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

      const { data: { publicUrl } } = supabase.storage
        .from("event-photos")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading QR:", error);
      return null;
    }
  };

  const handleStepAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep1Complete()) {
      toast({
        title: "Faltan campos obligatorios",
        description: "Complétalos para poder continuar",
        variant: "destructive",
      });
      return;
    }
    if (!validateEventDates()) {
      toast({
        title: t("form.errorTitle"),
        description: t("form.errors.invalidDates"),
        variant: "destructive",
      });
      return;
    }
    setCurrentStep(2);
  };

  const handleStepBack = () => setCurrentStep(1);

  const handleNextClick = () => {
    if (currentStep === 1 && !isStep1Complete()) {
      toast({
        title: "Faltan campos obligatorios",
        description: "Complétalos para poder continuar",
        variant: "destructive",
      });
    }
    if (currentStep === 2 && !isStep2Complete()) {
      toast({
        title: "Faltan campos obligatorios",
        description: "Complétalos para poder continuar",
        variant: "destructive",
      });
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
        title: t("summary.copyErrorTitle"),
        description: t("form.errors.imageUpload"),
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEventDates()) {
      toast({
        title: t("form.errorTitle"),
        description: t("form.errors.invalidDates"),
        variant: "destructive",
      });
      return;
    }
    
    // Validate contact fields
    if (!formData.contactEmail.trim()) {
      toast({
        title: t("summary.copyErrorTitle"),
        description: t("form.errors.emailRequired"),
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.contactEmail)) {
      toast({
        title: t("summary.copyErrorTitle"),
        description: t("form.errors.emailInvalid"),
        variant: "destructive",
      });
      return;
    }

    if (!formData.contactPassword || formData.contactPassword.length < 8) {
      toast({
        title: t("summary.copyErrorTitle"),
        description: t("form.errors.passwordMin"),
        variant: "destructive",
      });
      return;
    }

    if (formData.contactPassword !== formData.contactPasswordConfirm) {
      toast({
        title: t("summary.copyErrorTitle"),
        description: t("form.errors.passwordMismatch"),
        variant: "destructive",
      });
      return;
    }
    if (!formData.backgroundImage && !formData.backgroundImageUrl) {
      toast({
        title: t("form.errors.invalidDateTitle"),
        description: "La fotografía de fondo es obligatoria.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const eventTz = formData.timezone;
      const effectiveStartDate = getEffectiveStartDate();
      const effectiveStartTime = getEffectiveStartTime();
      const uploadStartDateTime = fromZonedTime(`${effectiveStartDate}T${effectiveStartTime}:00`, eventTz);
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

      const { data, error } = await supabase.functions.invoke("create-demo-event", {
        body: {
          contactEmail: formData.contactEmail,
          password: formData.contactPassword,
          phone: formData.contactPhone,
          event: {
            name: formData.name,
            password_hash: formData.password,
            admin_password: formData.adminPassword,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: 10,
            custom_image_url: customImageUrl,
            background_image_url: backgroundImageUrl,
            filter_type: formData.filterType,
            font_family: formData.fontFamily,
            font_size: formData.fontSize,
            country_code: formData.countryCode,
            timezone: formData.timezone,
            language: formData.language,
            description: formData.description || null,
          },
        },
      });

      if (error) {
        let errorCode = (error as any)?.message || "";
        try {
          const res = (error as any)?.context;
          if (res && typeof res.json === "function") {
            const body = await res.json();
            errorCode = body?.error || errorCode;
          }
        } catch {
          // ignore
        }

        if (errorCode === "DEMO_ALREADY_EXISTS") {
          toast({
            title: t("form.errors.demoExistsTitle"),
            description: t("form.errors.demoExistsDesc"),
            variant: "destructive",
          });
          navigate(`${pathPrefix}/admin-login?reason=exists&email=${encodeURIComponent(formData.contactEmail)}`);
          return;
        }
        if (errorCode === "USER_EXISTS" || `${errorCode}`.includes("USER_EXISTS")) {
          toast({
            title: t("form.errors.userExistsTitle"),
            description: t("form.errors.userExistsDesc"),
            variant: "destructive",
          });
          navigate(`${pathPrefix}/admin-login?reason=exists&email=${encodeURIComponent(formData.contactEmail)}`);
          return;
        }
        throw error;
      }

      const newEvent = data?.event;
      if (!newEvent) throw new Error("No se pudo crear el evento");

      const eventUrl = `https://acceso.revelao.cam/events/${newEvent.password_hash}`;
      const qrUrl = await uploadQrImage(eventUrl, newEvent.id);
      if (qrUrl) {
        localStorage.setItem(`event-qr-url-${newEvent.id}`, qrUrl);
      } else {
        const fallbackQr = `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(eventUrl)}`;
        localStorage.setItem(`event-qr-url-${newEvent.id}`, fallbackQr);
      }

      // Navigate to summary page with event data
      navigate(`${pathPrefix}/nuevoeventodemo/resumen`, { 
        state: { 
          event: newEvent,
          qrUrl,
          contactInfo: {
            email: formData.contactEmail,
            phone: formData.contactPhone,
          }
        } 
      });

    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: t("summary.copyErrorTitle"),
        description: t("form.errors.eventCreate"),
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
            src={logoDemo} 
            alt="Revelao.com" 
            className="h-16 w-auto"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center">
            {t("form.title")}
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            {t("form.subtitle")}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          <Card className="p-6">
            <form onSubmit={currentStep === 1 ? handleStepAdvance : handleSubmit} className="space-y-6">
              {currentStep === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      {t("form.step1.eventName")}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("form.step1.eventNamePlaceholder")}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("form.step1.font")}</Label>
                    <FontSelect
                      value={formData.fontFamily}
                      onChange={(fontFamily) => setFormData({ ...formData, fontFamily })}
                      previewText={formData.name || t("form.step1.eventName")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t("form.step1.description")}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={t("form.step1.descriptionPlaceholder")}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backgroundImage">
                      {t("form.step1.background")}
                      <span className="text-red-500"> *</span>
                    </Label>
                    <div className="text-xs text-muted-foreground mb-2 space-y-1">
                      <p>{t("form.step1.backgroundHelp")}</p>
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
                      required={!formData.backgroundImageUrl}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData({ ...formData, backgroundImage: file });
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("form.filterLabel")}</Label>
                    <div className="md:hidden">
                      <Carousel opts={{ align: "start" }} className="w-full">
                        <CarouselContent className="ml-0">
                          {FILTER_ORDER.map((filter) => {
                            const isActive = formData.filterType === filter;
                            return (
                              <CarouselItem key={filter} className="basis-[70%] sm:basis-1/3 pl-0 pr-3">
                                <button
                                  type="button"
                                  onClick={() => setFormData({ ...formData, filterType: filter })}
                                  className="w-full text-left"
                                >
                                  <div
                                className={`relative overflow-hidden rounded-lg border ${
                                  isActive
                                    ? "border-[hsl(var(--revelao-red))] ring-2 ring-[hsl(var(--revelao-red)/0.5)]"
                                    : "border-border"
                                }`}
                                  >
                                    <img
                                      src={weddingPreview}
                                      alt={t(`form.filter.${filter}`)}
                                      className={`h-32 w-full object-cover ${getFilterClass(filter)}`}
                                    />
                                    {getGrainClass(filter) ? (
                                      <div className={`pointer-events-none absolute inset-0 ${getGrainClass(filter)}`} />
                                    ) : null}
                                  </div>
                              <p className={`mt-2 text-xs ${isActive ? "text-[hsl(var(--revelao-red))] font-semibold" : "text-muted-foreground"}`}>
                                {t(`form.filter.${filter}`)}
                              </p>
                                </button>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>
                        <CarouselPrevious className="hidden sm:inline-flex" />
                        <CarouselNext className="hidden sm:inline-flex" />
                      </Carousel>
                    </div>

                    <div className="hidden md:grid grid-cols-4 gap-4">
                      {FILTER_ORDER.map((filter) => {
                        const isActive = formData.filterType === filter;
                        return (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setFormData({ ...formData, filterType: filter })}
                            className="w-full text-left"
                          >
                            <div
                          className={`relative overflow-hidden rounded-lg border ${
                            isActive
                              ? "border-[hsl(var(--revelao-red))] ring-2 ring-[hsl(var(--revelao-red)/0.5)]"
                              : "border-border"
                          }`}
                            >
                              <img
                                src={weddingPreview}
                                alt={t(`form.filter.${filter}`)}
                                className={`h-32 w-full object-cover ${getFilterClass(filter)}`}
                              />
                              {getGrainClass(filter) ? (
                                <div className={`pointer-events-none absolute inset-0 ${getGrainClass(filter)}`} />
                              ) : null}
                            </div>
                          <p className={`mt-2 text-xs ${isActive ? "text-[hsl(var(--revelao-red))] font-semibold" : "text-muted-foreground"}`}>
                            {t(`form.filter.${filter}`)}
                          </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>


                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("form.step1.country")}</Label>
                      <CountrySelect
                        value={formData.countryCode}
                        onChange={(countryCode, timezone) =>
                          setFormData({ ...formData, countryCode, timezone })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("form.step1.language")}</Label>
                      <LanguageSelect
                        value={formData.language as Language}
                        onChange={(language) => setFormData({ ...formData, language })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">{t("form.step1.duration")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("form.step1.durationHelp")}
                    </p>
                    <Label>
                      {t("form.step1.startDate")}
                      <span className="text-red-500"> *</span>
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={() => setStartMode("now")}
                        className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                          startMode === "now"
                            ? "border-[hsl(var(--revelao-red))] text-[hsl(var(--revelao-red))]"
                            : "border-border bg-background text-foreground"
                        }`}
                      >
                        Ahora
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartMode("schedule")}
                        className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                          startMode === "schedule"
                            ? "border-[hsl(var(--revelao-red))] text-[hsl(var(--revelao-red))]"
                            : "border-border bg-background text-foreground"
                        }`}
                      >
                        Programar inicio
                      </button>
                    </div>
                    {startMode === "schedule" ? (
                      <DateTimeField
                        dateId="uploadStartDate"
                        timeId="uploadStartTime"
                        dateLabel={
                          <>
                            {t("form.step1.startDate")}
                            <span className="text-red-500"> *</span>
                          </>
                        }
                        timeLabel={
                          <>
                            {t("form.step1.startTime")}
                            <span className="text-red-500"> *</span>
                          </>
                        }
                        dateValue={formData.uploadStartDate}
                        timeValue={formData.uploadStartTime}
                        required
                        onDateChange={(nextDate) => {
                          setFormData({
                            ...formData,
                            uploadStartDate: nextDate,
                          });
                        }}
                        onTimeChange={(nextTime) =>
                          setFormData({
                            ...formData,
                            uploadStartTime: nextTime,
                          })
                        }
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Se iniciará ahora ({format(nowTz, "dd/MM/yyyy HH:mm")} {timezoneOffsetLabel}).
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <DateTimeField
                      dateId="uploadEndDate"
                      timeId="uploadEndTime"
                      dateLabel={
                        <>
                          {t("form.step1.endDate")}
                          <span className="text-red-500"> *</span>
                        </>
                      }
                      timeLabel={
                        <>
                          {t("form.step1.endTime")}
                          <span className="text-red-500"> *</span>
                        </>
                      }
                      dateValue={formData.uploadEndDate}
                      timeValue={formData.uploadEndTime}
                      dateMin={maxDate(todayStr, getEffectiveStartDate())}
                      timeMin={getEndTimeMin()}
                      required
                      onDateChange={(nextDate) => {
                        const nextEndTime = clampTime(
                          formData.uploadEndTime,
                          getEndTimeMin(nextDate)
                        );
                        setFormData({
                          ...formData,
                          uploadEndDate: nextDate,
                          uploadEndTime: nextEndTime,
                        });
                      }}
                      onTimeChange={(nextTime) =>
                        setFormData({
                          ...formData,
                          uploadEndTime: clampTime(nextTime, getEndTimeMin()),
                        })
                      }
                    />
                    {formData.countryCode !== "ES" && formData.uploadStartDate && formData.uploadEndDate && (
                      <p className="text-xs text-muted-foreground">
                        {t("form.step1.spainTime")} {(() => {
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
                    <Label className="text-base font-semibold">{t("form.step1.reveal")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("form.step1.revealHelp")}
                    </p>
                    <DateTimeField
                      dateId="revealDate"
                      timeId="revealTime"
                      dateLabel={
                        <>
                          {t("form.step1.revealDate")}
                          <span className="text-red-500"> *</span>
                        </>
                      }
                      timeLabel={
                        <>
                          {t("form.step1.revealTime")}
                          <span className="text-red-500"> *</span>
                        </>
                      }
                      dateValue={formData.revealDate}
                      timeValue={formData.revealTime}
                      dateMin={maxDate(todayStr, formData.uploadStartDate, formData.uploadEndDate)}
                      timeMin={getRevealTimeMin()}
                      required
                      onDateChange={(nextDate) => {
                        const nextRevealTime = clampTime(
                          formData.revealTime,
                          getRevealTimeMin(nextDate)
                        );
                        setFormData({
                          ...formData,
                          revealDate: nextDate,
                          revealTime: nextRevealTime,
                        });
                      }}
                      onTimeChange={(nextTime) =>
                        setFormData({
                          ...formData,
                          revealTime: clampTime(nextTime, getRevealTimeMin()),
                        })
                      }
                    />
                    {formData.countryCode !== "ES" && formData.revealDate && (
                      <p className="text-xs text-muted-foreground">
                        {t("form.step1.spainTime")} {(() => {
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
                </>
              )}

              {currentStep === 2 && (
                <>
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">{t("form.step2.title")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("form.step2.subtitle")}
                    </p>

                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">
                        {t("form.step2.email")}
                        <span className="text-red-500"> *</span>
                      </Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                        required
                        placeholder={t("form.step2.emailPlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPassword">
                        {t("form.step2.password")}
                        <span className="text-red-500"> *</span>
                      </Label>
                      <Input
                        id="contactPassword"
                        type="password"
                        value={formData.contactPassword}
                        onChange={(e) => setFormData({ ...formData, contactPassword: e.target.value })}
                        required
                        placeholder={t("form.step2.passwordPlaceholder")}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPasswordConfirm">
                        {t("form.step2.passwordConfirm")}
                        <span className="text-red-500"> *</span>
                      </Label>
                      <Input
                        id="contactPasswordConfirm"
                        type="password"
                        value={formData.contactPasswordConfirm}
                        onChange={(e) => setFormData({ ...formData, contactPasswordConfirm: e.target.value })}
                        required
                        placeholder={t("form.step2.passwordConfirmPlaceholder")}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">{t("form.step2.phone")}</Label>
                      <Input
                        id="contactPhone"
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        placeholder={t("form.step2.phonePlaceholder")}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3">
                {currentStep === 2 && (
                  <Button type="button" variant="outline" className="flex-1" onClick={handleStepBack}>
                    {t("form.actions.back")}
                  </Button>
                )}
                <Button
                  type="submit"
                  className={`flex-1 ${
                    (currentStep === 1
                      ? !isStep1Complete() || uploadingImage
                      : !isStep2Complete() || isSubmitting || uploadingImage)
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  aria-disabled={currentStep === 1
                    ? !isStep1Complete() || uploadingImage
                    : !isStep2Complete() || isSubmitting || uploadingImage}
                  onClick={handleNextClick}
                >
                  {currentStep === 1
                    ? t("form.actions.next")
                    : uploadingImage
                      ? t("form.actions.uploading")
                      : isSubmitting
                        ? t("form.actions.creating")
                        : t("form.actions.create")}
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
                  allowVideoRecording={false}
                  allowAudioRecording={false}
                  headerStyle="modern"
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
