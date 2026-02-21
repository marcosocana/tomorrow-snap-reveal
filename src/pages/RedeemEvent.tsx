import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { QRCodeSVG } from "qrcode.react";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily } from "@/lib/eventFonts";
import { FilterType } from "@/lib/photoFilters";
import logoDemo from "@/assets/Frame 626035.png";
import { useAdminI18n } from "@/lib/adminI18n";

const generateHash = (): string => Math.random().toString(36).substring(2, 10);

type RedeemPlan = {
  id: string;
  label: string;
  maxPhotos: number | null;
};

const RedeemEvent = () => {
  const { token } = useParams<{ token: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [plan, setPlan] = useState<RedeemPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => {
    const now = new Date();
    const currentTime = format(now, "HH:mm");

    return {
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
      customImageUrl: "",
      backgroundImage: null as File | null,
      backgroundImageUrl: "",
      filterType: "none" as FilterType,
      fontFamily: "system" as EventFontFamily,
      fontSize: "text-3xl",
      countryCode: "ES",
      timezone: "Europe/Madrid",
      language: "es",
      description: "",
    };
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pathPrefix } = useAdminI18n();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(`${pathPrefix}/admin-login?redirect=${encodeURIComponent(`${pathPrefix}/redeem/${token}`)}`);
      }
    };
    checkSession();
  }, [navigate, token]);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!token) return;
      setLoadingPlan(true);
      setPlanError(null);
      try {
        const { data, error } = await supabase.functions.invoke(`redeem-get?token=${token}`, {
          method: "GET",
        });
        if (error || !data?.plan) {
          throw error || new Error("INVALID_TOKEN");
        }
        setPlan(data.plan as RedeemPlan);
      } catch {
        setPlanError("El enlace de canje no es válido o ha caducado.");
      } finally {
        setLoadingPlan(false);
      }
    };
    fetchPlan();
  }, [token]);

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
    if (!formData.name.trim()) {
      return;
    }
    setCurrentStep(2);
  };

  const handleStepBack = () => setCurrentStep(1);

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
    if (!token) return;
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

      const { data, error } = await supabase.functions.invoke("redeem-create-event", {
        body: {
          token,
          event: {
            name: formData.name,
            password_hash: formData.password,
            admin_password: formData.adminPassword,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
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

      if (error) throw error;

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

      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email;
      if (userEmail) {
        await supabase.functions.invoke("send-demo-event-email", {
          body: {
            event: newEvent,
            qrUrl: qrUrl || localStorage.getItem(`event-qr-url-${newEvent.id}`),
            contactInfo: { email: userEmail },
            eventType: "paid",
            planLabel: plan?.label ?? null,
          },
        });
      }

      toast({
        title: "Evento creado",
        description: "Tu evento de pago se ha creado correctamente.",
      });
      navigate("/event-management");
    } catch (error) {
      console.error("Error creating paid event:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el evento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingPlan) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (planError) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Card className="p-6 text-center max-w-md">
          <h2 className="text-lg font-semibold mb-2">Enlace no válido</h2>
          <p className="text-muted-foreground">{planError}</p>
        </Card>
      </div>
    );
  }

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
            Crea tu evento de pago
          </h1>
          <p className="text-muted-foreground text-center max-w-md">
            {plan ? `Plan ${plan.label}` : "Configura tu evento"}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          <Card className="p-6">
            <form onSubmit={currentStep === 1 ? handleStepAdvance : handleSubmit} className="space-y-6">
              {currentStep === 1 && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del evento *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipografía</Label>
                    <FontSelect
                      value={formData.fontFamily}
                      onChange={(fontFamily) => setFormData({ ...formData, fontFamily })}
                      previewText={formData.name || "Nombre del evento"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción del evento</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Escribe el texto que quieres que aparezca en la pantalla"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backgroundImage">Fotografía de fondo (opcional)</Label>
                    <div className="text-xs text-muted-foreground mb-2 space-y-1">
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

                  <div className="space-y-2">
                    <Label htmlFor="customImage">Logo personalizado (opcional)</Label>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>¿Dónde es el evento?</Label>
                      <CountrySelect
                        value={formData.countryCode}
                        onChange={(countryCode, timezone) =>
                          setFormData({ ...formData, countryCode, timezone })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Idioma</Label>
                      <LanguageSelect
                        value={formData.language as Language}
                        onChange={(language) => setFormData({ ...formData, language })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Duración del evento</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="uploadStartDate">Fecha de inicio</Label>
                        <Input
                          id="uploadStartDate"
                          type="date"
                          value={formData.uploadStartDate}
                          onChange={(e) => setFormData({ ...formData, uploadStartDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uploadStartTime">Hora de inicio</Label>
                        <Input
                          id="uploadStartTime"
                          type="time"
                          value={formData.uploadStartTime}
                          onChange={(e) => setFormData({ ...formData, uploadStartTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
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
                        <Label htmlFor="uploadEndTime">Hora de fin</Label>
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
                        En España: {(() => {
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
                    <Label className="text-base font-semibold">Revelado</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="revealDate">Fecha del revelado</Label>
                        <Input
                          id="revealDate"
                          type="date"
                          value={formData.revealDate}
                          onChange={(e) => setFormData({ ...formData, revealDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="revealTime">Hora del revelado</Label>
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
                        En España: {(() => {
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
                    <Label className="text-base font-semibold">Confirma tu evento</Label>
                    <p className="text-xs text-muted-foreground">
                      Revisa la información antes de crear el evento de pago.
                    </p>
                    {plan ? (
                      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                        <p><strong>Plan:</strong> {plan.label}</p>
                        <p><strong>Máximo de fotos:</strong> {plan.maxPhotos ?? "Sin límite"}</p>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3">
                {currentStep === 2 && (
                  <Button type="button" variant="outline" className="flex-1" onClick={handleStepBack}>
                    Atrás
                  </Button>
                )}
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={currentStep === 1 ? !formData.name.trim() || uploadingImage : isSubmitting || uploadingImage}
                >
                  {currentStep === 1
                    ? "Siguiente"
                    : uploadingImage
                      ? "Subiendo imagen..."
                      : isSubmitting
                        ? "Creando evento..."
                        : "Crear evento de pago"}
                </Button>
              </div>
            </form>
          </Card>

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

export default RedeemEvent;
