import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FontSelect from "@/components/FontSelect";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, Check, Copy, Download, ImagePlus, Loader2, LockKeyhole, Pencil, RefreshCw, Trash2, Video } from "lucide-react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import JSZip from "jszip";
import {
  TIME_CAPSULE_MAX_VIDEO_SECONDS,
  TIME_CAPSULE_DEFAULT_DESCRIPTION,
  TIME_CAPSULE_DEFAULT_LOGO_LINK,
  TIME_CAPSULE_PLAN_ID,
  TIME_CAPSULE_YEAR_OPTIONS,
  addYears,
  getTimeCapsulePublicUrl,
  getTimeCapsuleSettings,
  normalizeTimeCapsuleLogoLink,
  withTimeCapsuleSettings,
  type TimeCapsuleLogoMode,
} from "@/lib/timeCapsule";
import type { Json } from "@/integrations/supabase/types";
import type { EventFontFamily } from "@/lib/eventFonts";
import DeferredVideo from "@/components/DeferredVideo";

interface TimeCapsuleAdminFormProps {
  eventId?: string;
  pathPrefix: string;
  ownerEmail?: string;
  onOwnerEmailChange?: (value: string) => void;
  isSuperAdmin?: boolean;
  redeemToken?: string | null;
}

type CapsuleVideo = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  capturedAt: string;
  guestName: string | null;
};

const TIMEZONE = "Europe/Madrid";

const generateTimeCapsulePassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
};

const sanitizeDownloadName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "capsula";

const getDownloadExtension = (url: string, contentType: string | null) => {
  const pathname = new URL(url).pathname;
  const fileName = pathname.split("/").pop() || "";
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "";
  if (extension && /^[a-z0-9]+$/i.test(extension)) return extension.toLowerCase();
  if (contentType?.includes("mp4")) return "mp4";
  if (contentType?.includes("quicktime")) return "mov";
  return "webm";
};

const TimeCapsuleAdminForm = ({
  eventId,
  pathPrefix,
  ownerEmail = "",
  onOwnerEmailChange,
  isSuperAdmin = false,
  redeemToken = null,
}: TimeCapsuleAdminFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  const isEditing = !!eventId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState(TIME_CAPSULE_DEFAULT_DESCRIPTION);
  const [fontFamily, setFontFamily] = useState<EventFontFamily>("system");
  const [coverUrl, setCoverUrl] = useState("");
  const [weddingStartDate, setWeddingStartDate] = useState("");
  const [weddingStartTime, setWeddingStartTime] = useState("");
  const [weddingEndDate, setWeddingEndDate] = useState("");
  const [weddingEndTime, setWeddingEndTime] = useState("");
  const [years, setYears] = useState<number>(5);
  const [logoMode, setLogoMode] = useState<TimeCapsuleLogoMode>("default");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoLink, setLogoLink] = useState(TIME_CAPSULE_DEFAULT_LOGO_LINK);
  const [password, setPassword] = useState(() => redeemToken ? generateTimeCapsulePassword() : "");
  const [limitsJson, setLimitsJson] = useState<Json | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(eventId ?? null);
  const [createdEvent, setCreatedEvent] = useState<{
    id: string;
    name: string;
    password_hash: string;
    admin_password: string;
    upload_start_time: string;
    upload_end_time: string;
    owner_email: string;
    email_sent: boolean;
  } | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [contentUnlocked, setContentUnlocked] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [capsuleVideos, setCapsuleVideos] = useState<CapsuleVideo[]>([]);
  const [superAdminUnlockPassword, setSuperAdminUnlockPassword] = useState("");
  const [redeemPlanLabel, setRedeemPlanLabel] = useState("");
  const [redeemStep, setRedeemStep] = useState<1 | 2>(1);
  const [redeemNeedsCredentials, setRedeemNeedsCredentials] = useState(Boolean(redeemToken));
  const [redeemEmailLocked, setRedeemEmailLocked] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  useEffect(() => {
    if (!redeemToken) return;
    const loadRedeemPlan = async () => {
      const { data, error } = await supabase.functions.invoke(`redeem-get?token=${encodeURIComponent(redeemToken)}`, { method: "GET" });
      if (error || data?.product !== "capsule" || !data?.plan) {
        toast({ title: "Código no válido", description: "Este código de Cápsula no existe o ha caducado.", variant: "destructive" });
        return;
      }
      const purchaseEmail = data?.userEmail ? String(data.userEmail).trim().toLowerCase() : "";
      if (data?.isGift) {
        const { data: { session } } = await supabase.auth.getSession();
        const sessionEmail = session?.user.email?.trim().toLowerCase() || "";
        if (!session || !purchaseEmail || sessionEmail !== purchaseEmail) {
          const redeemPath = `${pathPrefix}/event-form?product=capsule&redeem=${encodeURIComponent(redeemToken)}`;
          navigate(`${pathPrefix}/admin-login?redirect=${encodeURIComponent(redeemPath)}&email=${encodeURIComponent(purchaseEmail)}`, { replace: true });
          return;
        }
        setRedeemNeedsCredentials(false);
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        setRedeemNeedsCredentials(true);
        setAccountEmail(purchaseEmail || session?.user.email?.trim().toLowerCase() || "");
        setRedeemEmailLocked(Boolean(purchaseEmail));
      }
      setRedeemPlanLabel(String(data.plan.label || "Cápsula del tiempo"));
    };
    void loadRedeemPlan();
  }, [navigate, pathPrefix, redeemToken, toast]);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      if (error || !data) {
        toast({ title: "Error", description: "No se pudo cargar la cápsula.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const settings = getTimeCapsuleSettings(data.limits_json as Json);
      setName(data.name);
      setDescription(data.description || "");
      setFontFamily((data.font_family as EventFontFamily) || "system");
      setCoverUrl(data.custom_image_url || "");
      setPassword(data.password_hash);
      setYears(settings.years);
      setLogoMode(settings.logoMode);
      setLogoUrl(settings.logoUrl || "");
      setLogoLink(settings.logoLink || "");
      setLimitsJson((data.limits_json as Json) ?? null);
      if (data.upload_start_time) {
        setWeddingStartDate(formatInTimeZone(data.upload_start_time, TIMEZONE, "yyyy-MM-dd"));
        setWeddingStartTime(formatInTimeZone(data.upload_start_time, TIMEZONE, "HH:mm"));
      }
      if (data.upload_end_time) {
        setWeddingEndDate(formatInTimeZone(data.upload_end_time, TIMEZONE, "yyyy-MM-dd"));
        setWeddingEndTime(formatInTimeZone(data.upload_end_time, TIMEZONE, "HH:mm"));
      }
      setIsLoading(false);
    };
    load();
  }, [eventId, toast]);

  const openDate = useMemo(() => {
    if (!weddingStartDate || !weddingStartTime) return null;
    const base = fromZonedTime(`${weddingStartDate}T${weddingStartTime}:00`, TIMEZONE);
    if (Number.isNaN(base.getTime())) return null;
    return addYears(base, years);
  }, [weddingStartDate, weddingStartTime, years]);

  const loadCapsuleContent = async (passwordOverride?: string) => {
    if (!eventId) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const { data, error } = await supabase.functions.invoke("unlock-time-capsule", {
        method: "POST",
        body: { eventId, password: passwordOverride ?? unlockPassword },
      });
      if (error) {
        let code = "UNLOCK_FAILED";
        const context = (error as { context?: Response }).context;
        if (context) {
          try {
            const errorBody = await context.json() as { error?: string };
            code = errorBody.error || code;
          } catch {
            // Keep the generic code when the function did not return JSON.
          }
        }
        throw new Error(code);
      }
      setCapsuleVideos((data?.videos ?? []) as CapsuleVideo[]);
      if (isSuperAdmin && typeof data?.unlockPassword === "string") {
        setSuperAdminUnlockPassword(data.unlockPassword);
      }
      setContentUnlocked(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNLOCK_FAILED";
      const messages: Record<string, string> = {
        PASSWORD_REQUIRED: "Introduce la contraseña de descapsulamiento.",
        INVALID_PASSWORD: "La contraseña de descapsulamiento no es correcta.",
        FORBIDDEN: "No tienes permiso para acceder al contenido de esta cápsula.",
        CREDENTIAL_UNAVAILABLE: "Todavía no se ha podido recuperar la contraseña de esta cápsula.",
      };
      setContentError(messages[code] || "No se pudo abrir la cápsula. Inténtalo de nuevo.");
      setContentUnlocked(false);
    } finally {
      setContentLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (capsuleVideos.length === 0 || isDownloadingAll) return;
    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (let index = 0; index < capsuleVideos.length; index += 1) {
        const capsuleVideo = capsuleVideos[index];
        const response = await fetch(capsuleVideo.url);
        if (!response.ok) throw new Error(`VIDEO_DOWNLOAD_FAILED:${response.status}`);
        const blob = await response.blob();
        const guest = sanitizeDownloadName(capsuleVideo.guestName || "invitado");
        const capturedAt = format(new Date(capsuleVideo.capturedAt), "dd-MM-yyyy-HHmmss");
        const extension = getDownloadExtension(capsuleVideo.url, response.headers.get("content-type"));
        zip.file(
          `${String(index + 1).padStart(4, "0")}-${guest}-${capturedAt}.${extension}`,
          blob,
        );
      }

      const content = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${sanitizeDownloadName(name || "capsula-del-tiempo")}-contenido.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      toast({
        title: "Descarga preparada",
        description: `${capsuleVideos.length} vídeo${capsuleVideos.length === 1 ? "" : "s"} incluido${capsuleVideos.length === 1 ? "" : "s"} en el ZIP.`,
      });
    } catch (error) {
      console.error("Error downloading time capsule content:", error);
      toast({
        title: "No se pudo descargar el contenido",
        description: "Actualiza el contenido y vuelve a intentarlo.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  useEffect(() => {
    if (eventId && isSuperAdmin && !isLoading) void loadCapsuleContent("");
    // The superadmin access is loaded once after the event form finishes loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, isSuperAdmin, isLoading]);

  const publicUrl = savedEventId ? getTimeCapsulePublicUrl(savedEventId) : null;

  const handleCoverUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const extension = file.name.split(".").pop() || "jpg";
      const filePath = `capsule-covers/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("event-photos").upload(filePath, file, {
        contentType: file.type || undefined,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(filePath);
      setCoverUrl(data.publicUrl);
    } catch (error) {
      console.error("Error uploading capsule cover:", error);
      toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const extension = file.name.split(".").pop() || "png";
      const filePath = `capsule-logos/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("event-photos").upload(filePath, file, {
        contentType: file.type || undefined,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
    } catch (error) {
      console.error("Error uploading capsule logo:", error);
      toast({ title: "Error", description: "No se pudo subir el logo.", variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const advanceCapsuleRedeem = () => {
    const normalizedLogoLink = normalizeTimeCapsuleLogoLink(logoLink);
    if (
      !name.trim() || !weddingStartDate || !weddingStartTime || !weddingEndDate ||
      !weddingEndTime || !openDate || password.length < 8
    ) {
      toast({
        title: "Faltan datos",
        description: "Completa todos los campos obligatorios para continuar.",
        variant: "destructive",
      });
      return;
    }
    const uploadStart = fromZonedTime(`${weddingStartDate}T${weddingStartTime}:00`, TIMEZONE);
    const uploadEnd = fromZonedTime(`${weddingEndDate}T${weddingEndTime}:00`, TIMEZONE);
    if (Number.isNaN(uploadStart.getTime()) || Number.isNaN(uploadEnd.getTime()) || uploadEnd <= uploadStart) {
      toast({ title: "Horario no válido", description: "El final de la boda debe ser posterior al inicio.", variant: "destructive" });
      return;
    }
    if (logoMode === "custom" && !logoUrl) {
      toast({ title: "Falta el logo", description: "Sube un logo personalizado o elige otra opción.", variant: "destructive" });
      return;
    }
    if (logoMode !== "none" && logoLink.trim() && !normalizedLogoLink) {
      toast({ title: "Enlace no válido", description: "Introduce un enlace web válido para el logo.", variant: "destructive" });
      return;
    }
    setRedeemStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    const normalizedLogoLink = normalizeTimeCapsuleLogoLink(logoLink);
    if (
      !name.trim() ||
      !weddingStartDate ||
      !weddingStartTime ||
      !weddingEndDate ||
      !weddingEndTime ||
      !openDate ||
      password.length < 8 ||
      (!isEditing && !redeemToken && !ownerEmail.trim()) ||
      (redeemToken && redeemNeedsCredentials && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail.trim()) || accountPassword.length < 8))
    ) {
      toast({
        title: "Faltan datos",
        description: "Completa todos los campos obligatorios. La contraseña debe contener al menos 8 dígitos.",
        variant: "destructive",
      });
      return;
    }
    if (logoMode === "custom" && !logoUrl) {
      toast({ title: "Falta el logo", description: "Sube un logo personalizado o elige otra opción.", variant: "destructive" });
      return;
    }
    if (logoMode !== "none" && logoLink.trim() && !normalizedLogoLink) {
      toast({ title: "Enlace no válido", description: "Introduce un enlace web válido para el logo.", variant: "destructive" });
      return;
    }

    const uploadStart = fromZonedTime(`${weddingStartDate}T${weddingStartTime}:00`, TIMEZONE);
    const uploadEnd = fromZonedTime(`${weddingEndDate}T${weddingEndTime}:00`, TIMEZONE);
    if (Number.isNaN(uploadStart.getTime()) || Number.isNaN(uploadEnd.getTime()) || uploadEnd <= uploadStart) {
      toast({
        title: "Horario no válido",
        description: "El final de la boda debe ser posterior al inicio.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        font_family: fontFamily,
        custom_image_url: coverUrl || null,
        password_hash: password,
        admin_password: password,
        upload_start_time: uploadStart.toISOString(),
        upload_end_time: uploadEnd.toISOString(),
        // The future opening year is informational. Keep the platform's functional
        // reveal timestamp aligned with the end of the recording window.
        reveal_time: uploadEnd.toISOString(),
        hide_reveal_date: false,
        expiry_date: null,
        max_photos: 0,
        allow_video_recording: true,
        max_videos: 1000,
        max_video_duration: TIME_CAPSULE_MAX_VIDEO_SECONDS,
        allow_audio_recording: false,
        max_audios: 0,
        allow_image_attachment: false,
        allow_video_attachment: false,
        is_demo: false,
        type: TIME_CAPSULE_PLAN_ID,
        plan_id: TIME_CAPSULE_PLAN_ID,
        timezone: TIMEZONE,
        country_code: "ES",
        language: "es",
        limits_json: withTimeCapsuleSettings(limitsJson, {
          years,
          coupleNames: name,
          logoMode,
          logoUrl,
          logoLink: normalizedLogoLink,
        }),
      };

      if (isEditing && eventId) {
        const { error } = await supabase.from("events").update(payload as never).eq("id", eventId);
        if (error) throw error;
        setSavedEventId(eventId);
        toast({ title: "Cápsula actualizada", description: "Los cambios se han guardado." });
      } else {
        const functionName = redeemToken ? "redeem-create-time-capsule" : "admin-create-event";
        const body = redeemToken
          ? {
              token: redeemToken,
              contactEmail: redeemNeedsCredentials ? accountEmail.trim().toLowerCase() : undefined,
              password: redeemNeedsCredentials ? accountPassword : undefined,
              event: payload,
            }
          : { ownerEmail: ownerEmail.trim(), event: payload };
        const { data, error } = await supabase.functions.invoke(functionName, {
          method: "POST",
          body,
        });
        if (error) {
          let errorCode = error.message || "CREATE_EVENT_FAILED";
          const context = (error as { context?: Response }).context;
          if (context) {
            try {
              const errorBody = await context.json() as { error?: string };
              errorCode = errorBody.error || errorCode;
            } catch {
              // Preserve the function error when its response is not JSON.
            }
          }
          throw new Error(errorCode);
        }
        if (!data?.event) throw new Error("No se recibió el evento creado");
        if (redeemToken && redeemNeedsCredentials) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: accountEmail.trim().toLowerCase(),
            password: accountPassword,
          });
          if (signInError) console.error("Capsule account automatic sign in failed:", signInError);
        }
        const created = data.event;
        const summaryEmail = created.owner_email || ownerEmail.trim() || accountEmail.trim().toLowerCase();
        let emailSent = data.emailSent === true;
        if (summaryEmail && !emailSent) {
          const { data: emailData, error: emailError } = await supabase.functions.invoke("send-demo-event-email", {
            body: {
              event: created,
              contactInfo: { email: summaryEmail },
              eventType: "capsule",
              planLabel: redeemPlanLabel || "Cápsula del tiempo",
              lang: created.language || "es",
              publicUrl: getTimeCapsulePublicUrl(created.id),
            },
          });
          emailSent = !emailError && emailData?.success === true;
          if (emailError) console.error("Time capsule summary email retry failed:", emailError);
        }
        setSavedEventId(created.id);
        setCreatedEvent({
          id: created.id,
          name: created.name,
          password_hash: created.password_hash,
          admin_password: created.admin_password,
          upload_start_time: created.upload_start_time,
          upload_end_time: created.upload_end_time,
          owner_email: created.owner_email || ownerEmail.trim(),
          email_sent: emailSent,
        });
        toast({
          title: "Cápsula creada",
          description: !emailSent
            ? "La cápsula se creó, pero el email de resumen no pudo enviarse."
            : redeemToken
              ? "La cápsula se ha asociado a tu cuenta y hemos enviado el resumen por email."
              : "Hemos enviado al propietario el QR y la información del evento.",
          variant: emailSent ? "default" : "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving time capsule:", error);
      const errorCode = error instanceof Error ? error.message : "";
      if (errorCode.includes("INVALID_CREDENTIALS")) {
        toast({
          title: "Este usuario ya existe",
          description: (
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
          ),
          variant: "destructive",
        });
      } else if (errorCode.includes("EMAIL_MISMATCH")) {
        toast({
          title: "Email no válido",
          description: "Debes usar el mismo email asociado a este código.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: "No se pudo guardar la cápsula.", variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const downloadQr = async (eventName: string) => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgText = new XMLSerializer().serializeToString(svg);
    const source = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, 720, 720);
      context.drawImage(image, 0, 0, 720, 720);
      URL.revokeObjectURL(source);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qr-${eventName || "capsula"}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    image.src = source;
  };

  if (isLoading) {
    return (
      <div className="admin-demo2-shell min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (createdEvent) {
    const createdPublicUrl = getTimeCapsulePublicUrl(createdEvent.id);
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <img src="/LogoMiniRevelao.svg" alt="Revelao" className="h-12 w-auto" />
            <div className="flex items-center gap-2 text-green-600">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <Check className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-semibold">Cápsula creada correctamente</h1>
            </div>
            <p className={`text-sm ${createdEvent.email_sent ? "text-muted-foreground" : "font-medium text-destructive"}`}>
              {!createdEvent.email_sent
                ? "La cápsula está creada, pero el email de resumen no se ha podido enviar."
                : redeemToken
                  ? "La cápsula ya está asociada a tu cuenta y el resumen se ha enviado por email."
                  : "Se ha enviado al propietario un email con el QR, las fechas y sus credenciales."}
            </p>
          </div>

          <Card className="space-y-6 p-5 sm:p-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">{createdEvent.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Cápsula del tiempo</p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <a href={createdPublicUrl} target="_blank" rel="noreferrer" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div ref={qrRef} className="rounded-xl bg-white p-4 shadow-sm">
                  <QRCodeSVG value={createdPublicUrl} size={220} level="H" includeMargin />
                </div>
              </a>
              <Button type="button" variant="outline" className="gap-2" onClick={() => void downloadQr(createdEvent.name)}>
                <Download className="h-4 w-4" /> Descargar QR
              </Button>
            </div>

            <div className="space-y-4 border-t border-border pt-5 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">Enlace para invitados</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2">{createdPublicUrl}</code>
                  <Button type="button" variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(createdPublicUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <p><span className="font-medium">Email:</span><br />{createdEvent.owner_email}</p>
                <p><span className="font-medium">Contraseña:</span><br /><code className="text-base font-bold tracking-wider">{createdEvent.admin_password}</code></p>
                <p><span className="font-medium">Inicio de grabación:</span><br />{format(new Date(createdEvent.upload_start_time), "dd/MM/yyyy HH:mm")}</p>
                <p><span className="font-medium">Fin de grabación:</span><br />{format(new Date(createdEvent.upload_end_time), "dd/MM/yyyy HH:mm")}</p>
                <p className="sm:col-span-2"><span className="font-medium">Apertura informativa:</span><br />{openDate ? format(openDate, "dd/MM/yyyy") : "-"}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => navigate(`${pathPrefix}/event-management`)}>
                Volver a eventos
              </Button>
              <Button type="button" className="gap-2" onClick={() => navigate(`${pathPrefix}/event-form/${createdEvent.id}?product=capsule`)}>
                <Pencil className="h-4 w-4" /> Editar evento
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`${redeemToken ? "min-h-screen bg-background" : "admin-demo2-shell revelao-event-detail min-h-screen bg-background p-4 md:p-6 overflow-x-hidden"}`} data-scroll-container>
      <div className={redeemToken ? "mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:py-8" : "max-w-6xl mx-auto space-y-4 md:space-y-6"}>
        {redeemToken ? (
          <div className="mb-5 space-y-3">
            <div className="flex justify-center sm:justify-start">
              <img src="/LogoTransparent.png" alt="Revelao" className="h-8 w-auto" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Crea tu Cápsula del tiempo</h1>
              {redeemPlanLabel && <p className="text-sm text-muted-foreground">Plan: {redeemPlanLabel}</p>}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#f06a5f] transition-all"
                style={{ width: `${redeemNeedsCredentials && redeemStep === 1 ? 50 : 100}%` }}
              />
            </div>
          </div>
        ) : (
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(`${pathPrefix}/event-management`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-scroll-anchor>
            {isEditing ? name || "Cápsula del tiempo" : "Nueva cápsula del tiempo"}
          </h1>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
            Cápsula del tiempo
          </span>
        </div>
        )}

        {redeemPlanLabel && !isEditing && !redeemToken ? (
          <Card className="border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-900">
            Plan canjeado: <span className="font-semibold">{redeemPlanLabel}</span>
          </Card>
        ) : null}

        <div className={publicUrl ? "grid gap-6 lg:grid-cols-[1fr,280px]" : "grid gap-6"}>
        <Card className={`p-6 ${redeemToken ? "[&_input]:h-12 [&_input]:rounded-full [&_input]:px-4" : ""}`}>
          <form
            onSubmit={(event) => {
              if (redeemToken && redeemNeedsCredentials && redeemStep === 1) {
                event.preventDefault();
                advanceCapsuleRedeem();
                return;
              }
              void handleSubmit(event);
            }}
            className={`space-y-6 ${redeemToken ? "pb-20 sm:pb-0" : ""}`}
          >
            {(!redeemToken || !redeemNeedsCredentials || redeemStep === 1) && (
            <>
            <div className="space-y-2">
              <Label htmlFor="capsuleName">Nombre de los novios</Label>
              <Input
                id="capsuleName"
                value={name}
                onChange={(inputEvent) => setName(inputEvent.target.value)}
                placeholder="Ana & Marcos"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capsuleDescription">Texto para los invitados (opcional)</Label>
              <Textarea
                id="capsuleDescription"
                value={description}
                onChange={(inputEvent) => setDescription(inputEvent.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipografía del título</Label>
              <FontSelect
                value={fontFamily}
                onChange={setFontFamily}
                previewText={name || "Nombre del evento"}
              />
            </div>

            <div className="space-y-2">
              <Label>Foto de la cápsula</Label>
              <div className="flex items-center gap-3">
                {coverUrl ? (
                  <img src={coverUrl} alt="Portada" className="h-20 w-20 rounded-xl object-cover border border-border" />
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(inputEvent) => {
                    const file = inputEvent.target.files?.[0];
                    if (file) handleCoverUpload(file);
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                  {coverUrl ? "Cambiar foto" : "Subir foto"}
                </Button>
                {coverUrl && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setCoverUrl("")}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border p-4">
              <div>
                <h2 className="font-semibold text-foreground">Logo en la vista para invitados</h2>
                <p className="text-xs text-muted-foreground">
                  Aparecerá en el espacio donde los invitados dejan sus vídeos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capsuleLogoMode">Mostrar</Label>
                <select
                  id="capsuleLogoMode"
                  value={logoMode}
                  onChange={(selectEvent) => setLogoMode(selectEvent.target.value as TimeCapsuleLogoMode)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="default">Logo de Revelao</option>
                  <option value="custom">Logo personalizado</option>
                  <option value="none">Sin logo</option>
                </select>
              </div>

              {logoMode === "custom" && (
                <div className="space-y-2">
                  <Label>Imagen del logo</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    {logoUrl ? (
                      <div className="flex min-h-16 min-w-28 items-center justify-center rounded-xl border border-border bg-white p-3">
                        <img src={logoUrl} alt="Logo personalizado" className="max-h-12 max-w-40 object-contain" />
                      </div>
                    ) : null}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(inputEvent) => {
                        const file = inputEvent.target.files?.[0];
                        if (file) void handleLogoUpload(file);
                        inputEvent.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
                      {isUploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                      {logoUrl ? "Cambiar logo" : "Subir logo"}
                    </Button>
                    {logoUrl && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLogoUrl("")} aria-label="Quitar logo personalizado">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {logoMode !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="capsuleLogoLink">Enlace del logo (opcional)</Label>
                  <Input
                    id="capsuleLogoLink"
                    type="text"
                    inputMode="url"
                    value={logoLink}
                    onChange={(inputEvent) => setLogoLink(inputEvent.target.value)}
                    placeholder={TIME_CAPSULE_DEFAULT_LOGO_LINK}
                  />
                  <p className="text-xs text-muted-foreground">
                    Por defecto enlaza a www.revelao.cam. Déjalo vacío si no quieres que el logo sea clicable.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-border p-4">
              <div>
                <h2 className="font-semibold text-foreground">Horario de grabación</h2>
                <p className="text-xs text-muted-foreground">
                  El QR solo permitirá grabar vídeos entre el inicio y el final indicados.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capsuleWeddingStartDate">Cuándo empieza la boda</Label>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <Input
                      id="capsuleWeddingStartDate"
                      type="date"
                      value={weddingStartDate}
                      onChange={(inputEvent) => setWeddingStartDate(inputEvent.target.value)}
                      required
                    />
                    <Input
                      id="capsuleWeddingStartTime"
                      aria-label="Hora de inicio de la boda"
                      type="time"
                      value={weddingStartTime}
                      onChange={(inputEvent) => setWeddingStartTime(inputEvent.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capsuleWeddingEndDate">Cuándo termina la boda</Label>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <Input
                      id="capsuleWeddingEndDate"
                      type="date"
                      value={weddingEndDate}
                      onChange={(inputEvent) => setWeddingEndDate(inputEvent.target.value)}
                      required
                    />
                    <Input
                      id="capsuleWeddingEndTime"
                      aria-label="Hora de finalización de la boda"
                      type="time"
                      value={weddingEndTime}
                      onChange={(inputEvent) => setWeddingEndTime(inputEvent.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capsuleYears">Se abrirá dentro de</Label>
              <select
                id="capsuleYears"
                value={years}
                onChange={(selectEvent) => setYears(Number(selectEvent.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TIME_CAPSULE_YEAR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} años
                  </option>
                ))}
              </select>
              {openDate && (
                <p className="text-xs text-muted-foreground">
                  Dato informativo para los invitados. Fecha indicada de apertura: {format(openDate, "dd/MM/yyyy")}.
                </p>
              )}
            </div>

            {!isEditing && !redeemToken && onOwnerEmailChange && (
              <div className="space-y-2">
                <Label htmlFor="capsuleOwnerEmail">Email</Label>
                <Input
                  id="capsuleOwnerEmail"
                  type="email"
                  value={ownerEmail}
                  onChange={(inputEvent) => onOwnerEmailChange(inputEvent.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            )}

            {!isEditing && !redeemToken && (
              <div className="space-y-2">
                <Label htmlFor="capsulePassword">Contraseña de descapsulamiento</Label>
                <Input
                  id="capsulePassword"
                  type="password"
                  value={password}
                  onChange={(inputEvent) => setPassword(inputEvent.target.value)}
                  placeholder="Mínimo 8 dígitos"
                  autoComplete="new-password"
                  minLength={8}
                  aria-describedby="capsule-password-requirement"
                  required
                />
                <p id="capsule-password-requirement" className="text-xs text-muted-foreground">
                  La contraseña debe contener al menos 8 dígitos.
                </p>
              </div>
            )}
            </>
            )}

            {redeemToken && redeemNeedsCredentials && redeemStep === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold">Tu acceso</h2>
                  <p className="text-sm text-muted-foreground">
                    Introduce tu email y contraseña para terminar. Si el usuario no existe, lo crearemos; si ya existe, la contraseña deberá coincidir.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capsuleAccountEmail">Email</Label>
                  <Input
                    id="capsuleAccountEmail"
                    type="email"
                    value={accountEmail}
                    onChange={(event) => setAccountEmail(event.target.value)}
                    placeholder="tu@email.com"
                    autoComplete="email"
                    readOnly={redeemEmailLocked}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capsuleAccountPassword">Contraseña</Label>
                  <Input
                    id="capsuleAccountPassword"
                    type="password"
                    value={accountPassword}
                    onChange={(event) => setAccountPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="current-password"
                    minLength={8}
                    required
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes usuario y no recuerdas la contraseña?{" "}
                  <a href={`${pathPrefix}/reset-password`} className="font-semibold text-[#f06a5f] underline underline-offset-2">
                    Recupérala aquí
                  </a>
                  .
                </p>
              </div>
            )}

            <div className={redeemToken ? "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0" : ""}>
            {redeemToken && redeemNeedsCredentials && redeemStep === 1 ? (
              <Button type="button" className="h-12 w-full rounded-full gap-2" onClick={advanceCapsuleRedeem}>
                Siguiente <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-3">
                {redeemToken && redeemNeedsCredentials && redeemStep === 2 && (
                  <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setRedeemStep(1)} disabled={isSaving}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
                  </Button>
                )}
                <Button type="submit" className="h-12 flex-1 rounded-full" disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isEditing ? "Guardar cambios" : "Crear cápsula del tiempo"}
                </Button>
              </div>
            )}
            </div>
          </form>
        </Card>

        {publicUrl && (
        <aside className="space-y-4">
          <Card className="p-6 space-y-4 text-center lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold">QR para los invitados</h2>
            <div ref={qrRef} className="mx-auto flex w-fit justify-center rounded-xl bg-white p-4">
              <QRCodeSVG value={publicUrl} size={200} level="H" />
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={() => void downloadQr(name)}>
              <Download className="h-4 w-4" /> Descargar QR
            </Button>
            <p className="text-xs text-muted-foreground break-all">{publicUrl}</p>
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}>
              <Copy className="w-4 h-4 mr-2" /> Copiar enlace
            </Button>
          </Card>
        </aside>
        )}
        </div>

        {isEditing && (
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Contenido de la cápsula</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isSuperAdmin
                    ? "Acceso permanente de superadmin, aunque el evento todavía no haya terminado."
                    : "Puedes abrir y descargar el contenido en cualquier momento con la contraseña de descapsulamiento. Al finalizar el evento también la recibirás por email."}
                </p>
                {isSuperAdmin && (
                  <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contraseña de descapsulamiento</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <code className="rounded-lg bg-background px-3 py-2 text-base font-semibold tracking-wider">
                        {superAdminUnlockPassword || (contentLoading ? "Cargando…" : "No disponible")}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!superAdminUnlockPassword}
                        onClick={() => {
                          void navigator.clipboard.writeText(superAdminUnlockPassword);
                          toast({ title: "Contraseña copiada" });
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copiar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {(isSuperAdmin || contentUnlocked) && (
                <div className="flex flex-wrap gap-2">
                  {contentUnlocked && capsuleVideos.length > 0 && (
                    <Button type="button" size="sm" className="gap-2" onClick={() => void handleDownloadAll()} disabled={isDownloadingAll}>
                      {isDownloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {isDownloadingAll ? "Preparando ZIP…" : "Descargar todo"}
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => void loadCapsuleContent(isSuperAdmin ? "" : unlockPassword)} disabled={contentLoading || isDownloadingAll}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${contentLoading ? "animate-spin" : ""}`} /> Actualizar
                  </Button>
                </div>
              )}
            </div>

            {!isSuperAdmin && !contentUnlocked && (
              <form
                className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row"
                onSubmit={(submitEvent) => {
                  submitEvent.preventDefault();
                  void loadCapsuleContent();
                }}
              >
                <Input
                  type="password"
                  autoComplete="off"
                  value={unlockPassword}
                  onChange={(inputEvent) => setUnlockPassword(inputEvent.target.value)}
                  placeholder="Contraseña de descapsulamiento"
                  aria-label="Contraseña de descapsulamiento"
                  required
                />
                <Button type="submit" disabled={contentLoading || !unlockPassword.trim()}>
                  {contentLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Descapsular
                </Button>
              </form>
            )}

            {contentError && <p className="mt-4 text-sm font-medium text-destructive">{contentError}</p>}

            {contentLoading && !contentUnlocked && isSuperAdmin && (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando vídeos…
              </div>
            )}

            {contentUnlocked && (
              capsuleVideos.length > 0 ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {capsuleVideos.map((capsuleVideo) => (
                    <article key={capsuleVideo.id} className="overflow-hidden rounded-xl border border-border bg-muted/20">
                      <DeferredVideo
                        source={capsuleVideo.url}
                        poster={capsuleVideo.thumbnailUrl || undefined}
                        controls
                        playsInline
                        className="aspect-[9/16] max-h-[520px] w-full bg-black object-contain"
                      />
                      <div className="space-y-1 p-3 text-sm">
                        <p className="font-medium">{capsuleVideo.guestName || "Invitado"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(capsuleVideo.capturedAt), "dd/MM/yyyy HH:mm")}
                          {capsuleVideo.durationSeconds ? ` · ${capsuleVideo.durationSeconds}s` : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-10 text-center">
                  <Video className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Todavía no hay vídeos en esta cápsula</p>
                  <p className="mt-1 text-sm text-muted-foreground">Los vídeos enviados por los invitados aparecerán aquí.</p>
                </div>
              )
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default TimeCapsuleAdminForm;
