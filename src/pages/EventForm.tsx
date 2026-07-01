import { useState, useEffect, useRef } from "react";
import { useBeforeUnload, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Globe, Trash2, Camera, Video, Mic } from "lucide-react";
import { addDays, format } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import FontSizeSelect, { FontSizeOption } from "@/components/FontSizeSelect";
import EventPreview from "@/components/EventPreview";
import GalleryPreviewModal from "@/components/GalleryPreviewModal";
import { Language, getLanguageByCode } from "@/lib/translations";
import { getCountryByCode, getTimezoneOffset } from "@/lib/countries";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_ORDER, getFilterClass, getGrainClass } from "@/lib/photoFilters";
import { hashPassword } from "@/lib/hashPassword";
import { getEventQrPasswordSettings, withEventQrPasswordSettings } from "@/lib/eventQrPassword";
import { notifyAdminNewEvent } from "@/lib/adminEventNotification";
import { Json } from "@/integrations/supabase/types";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useAdminI18n } from "@/lib/adminI18n";
import { QRCodeSVG } from "qrcode.react";
const defaultQrLogo = "/marca_revelao_qr_evento.png";
const defaultDemoLogo = "/demo-logo.png";
import weddingPreview from "@/assets/testimonial-wedding.jpg";

// Background image - no size restrictions

interface Event {
  id: string;
  event_number?: number | null;
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
  allow_video_recording?: boolean;
  max_videos?: number | null;
  max_video_duration?: number | null;
  allow_audio_recording?: boolean;
  max_audios?: number | null;
  max_audio_duration?: number | null;
  allow_image_attachment?: boolean;
  allow_video_attachment?: boolean;
  header_style?: string | null;
  plan_id?: string | null;
  type?: string | null;
  limits_json?: Json | null;
}

const getDemoContactFromLimits = (raw: Json | null | undefined): { email: string | null; phone: string | null } => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { email: null, phone: null };
  }
  const contact = (raw as Record<string, Json | undefined>).demo_contact;
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    return { email: null, phone: null };
  }
  const record = contact as Record<string, Json | undefined>;
  return {
    email: typeof record.email === "string" && record.email.trim() ? record.email.trim() : null,
    phone: typeof record.phone === "string" && record.phone.trim() ? record.phone.trim() : null,
  };
};

const getQrImageUrlFromLimits = (raw: Json | null | undefined) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const qrImageUrl = (raw as Record<string, Json | undefined>).qr_image_url;
  return typeof qrImageUrl === "string" && qrImageUrl.trim() ? qrImageUrl.trim() : null;
};

const isNuevoEventoDemo2 = (raw: Json | null | undefined) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return (raw as Record<string, Json | undefined>).created_from === "nuevoeventodemo2";
};

type HeaderStyle = "gradient" | "modern";
type PlanType = "demo" | "small" | "medium" | "xxl" | "custom";
type EventFormStep = "general" | "space" | "dates" | "options";

const EVENT_FORM_STEPS: Array<{ value: EventFormStep; label: string }> = [
  { value: "general", label: "General" },
  { value: "space", label: "Espacio" },
  { value: "dates", label: "Fechas" },
  { value: "options", label: "Opciones" },
];

const PLAN_LIMITS: Record<
  Exclude<PlanType, "custom">,
  {
    maxPhotos: string;
    allowVideoRecording: boolean;
    maxVideos: string;
    allowAudioRecording: boolean;
    maxAudios: string;
  }
> = {
  demo: {
    maxPhotos: "10",
    allowVideoRecording: true,
    maxVideos: "3",
    allowAudioRecording: true,
    maxAudios: "6",
  },
  small: {
    maxPhotos: "200",
    allowVideoRecording: true,
    maxVideos: "30",
    allowAudioRecording: true,
    maxAudios: "60",
  },
  medium: {
    maxPhotos: "1200",
    allowVideoRecording: true,
    maxVideos: "90",
    allowAudioRecording: true,
    maxAudios: "200",
  },
  xxl: {
    maxPhotos: "",
    allowVideoRecording: true,
    maxVideos: "",
    allowAudioRecording: true,
    maxAudios: "",
  },
};

const EventForm = () => {
  const { eventId } = useParams<{ eventId?: string }>();
  const isEditing = !!eventId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [adminEventId] = useState(() => localStorage.getItem("adminEventId"));
  const [isRestrictedAdmin] = useState(() => !!localStorage.getItem("adminEventId"));
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string | null>(null);
  const [eventNumber, setEventNumber] = useState<number | null>(null);
  const [ownerEmailInput, setOwnerEmailInput] = useState("");
  const [qrPreview, setQrPreview] = useState<{ src?: string; value: string } | null>(null);
  const [galleryPreviewOpen, setGalleryPreviewOpen] = useState(false);
  const [mediaCounts, setMediaCounts] = useState({ photos: 0, videos: 0, audios: 0 });
  const [backgroundAdjustOpen, setBackgroundAdjustOpen] = useState(false);
  const [pendingBackgroundSrc, setPendingBackgroundSrc] = useState<string | null>(null);
  const [backgroundAdjustX, setBackgroundAdjustX] = useState(50);
  const [backgroundAdjustY, setBackgroundAdjustY] = useState(50);
  const [backgroundAdjustZoom, setBackgroundAdjustZoom] = useState(1);
  const [planType, setPlanType] = useState<PlanType>("demo");
  const [activeFormStep, setActiveFormStep] = useState<EventFormStep>("general");
  const [maxUnlockedFormStep, setMaxUnlockedFormStep] = useState(0);
  const [savedEditSnapshot, setSavedEditSnapshot] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);
  const allowNavigationRef = useRef(false);
  // Generate a random 8-character hash for passwords
  const generateHash = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let hash = '';
    for (let i = 0; i < 8; i++) {
      hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
  };

  const [formData, setFormData] = useState(() => {
    // Only generate hashes for new events, not when editing
    const initialPassword = isEditing ? "" : generateHash();
    const initialAdminPassword = isEditing ? "" : generateHash();
    const now = new Date();
    const initialUploadStartDate = format(now, "yyyy-MM-dd");
    const initialUploadStartTime = format(now, "HH:mm");
    const initialUploadEndDate = format(addDays(now, 1), "yyyy-MM-dd");
    const initialUploadEndTime = initialUploadStartTime;
    const initialRevealDate = format(addDays(now, 2), "yyyy-MM-dd");
    const initialRevealTime = initialUploadStartTime;
    
    return {
      name: "",
      password: initialPassword,
      adminPassword: initialAdminPassword,
      qrPasswordEnabled: false,
      qrPassword: "",
      qrPasswordHash: "",
      qrPasswordScope: {
        camera: true,
        gallery: true,
      },
      limitsJson: null as Json | null,
      uploadStartDate: initialUploadStartDate,
      uploadStartTime: initialUploadStartTime,
      uploadEndDate: initialUploadEndDate,
      uploadEndTime: initialUploadEndTime,
      revealDate: initialRevealDate,
      revealTime: initialRevealTime,
      maxPhotos: isDemoMode ? "30" : "",
      customImage: null as File | null,
      customImageUrl: isDemoMode ? defaultDemoLogo : "",
      backgroundImage: null as File | null,
      backgroundImageUrl: "",
      filterType: "none" as FilterType,
      fontFamily: "dancing-script" as EventFontFamily,
      fontSize: "text-3xl" as FontSizeOption,
      countryCode: "ES",
      timezone: "Europe/Madrid",
      language: "es",
      description: "",
      expiryDate: "",
      expiryTime: "23:59",
      expiryRedirectUrl: "",
      allowPhotoDeletion: true,
      allowPhotoSharing: true,
      showLegalText: false,
      legalTextType: "default" as "default" | "custom",
      customTermsText: "",
      customPrivacyText: "",
      galleryViewMode: "normal" as "normal" | "grid",
      likeCountingEnabled: false,
      allowVideoRecording: false,
      maxVideos: "",
      maxVideoDuration: "15",
      allowAudioRecording: false,
      maxAudios: "",
      maxAudioDuration: "30",
      allowImageAttachment: false,
      allowVideoAttachment: false,
      headerStyle: "modern" as HeaderStyle,
    };
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();
  const isDemoEvent = planType === "demo";
  const eventUrl = eventId ? `https://acceso.revelao.cam/events/${formData.password}` : "";
  const mediaLimits = {
    photos: formData.maxPhotos?.trim() ? formData.maxPhotos : "∞",
    videos: formData.allowVideoRecording
      ? (formData.maxVideos?.trim() ? formData.maxVideos : "∞")
      : "0",
    audios: formData.allowAudioRecording
      ? (formData.maxAudios?.trim() ? formData.maxAudios : "∞")
      : "0",
  };
  const getEditSnapshot = (data = formData, plan = planType) =>
    JSON.stringify({
      formData: data,
      planType: plan,
    });
  const hasUnsavedEditChanges =
    isEditing &&
    !isLoading &&
    !!savedEditSnapshot &&
    getEditSnapshot() !== savedEditSnapshot;

  const navigateWithoutUnsavedPrompt = (to: string, options?: { state?: unknown; replace?: boolean }) => {
    allowNavigationRef.current = true;
    navigate(to, options);
  };

  const requestLeave = (action: () => void) => {
    if (!hasUnsavedEditChanges || allowNavigationRef.current) {
      action();
      return;
    }
    setPendingLeaveAction(() => action);
    setLeaveConfirmOpen(true);
  };

  const confirmLeaveWithoutSaving = () => {
    const action = pendingLeaveAction;
    setLeaveConfirmOpen(false);
    setPendingLeaveAction(null);
    allowNavigationRef.current = true;
    action?.();
  };
  useBeforeUnload(
    (event) => {
      if (!hasUnsavedEditChanges || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    },
    { capture: true }
  );

  useEffect(() => {
    if (!hasUnsavedEditChanges || allowNavigationRef.current) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank") return;

      event.preventDefault();
      requestLeave(() => {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) {
          navigate(`${url.pathname}${url.search}${url.hash}`);
        } else {
          window.location.href = url.href;
        }
      });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasUnsavedEditChanges, navigate]);

  const keepEditing = () => {
    setPendingLeaveAction(null);
    setLeaveConfirmOpen(false);
  };

  const formatTimezoneOffset = (timezone: string) => {
    const offsetMinutes = getTimezoneOffset(timezone);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const minutes = String(absMinutes % 60).padStart(2, "0");
    return `GMT${sign}${hours}:${minutes}`;
  };

  const getPlanPersistence = (value: PlanType) => ({
    is_demo: value === "demo",
    type: value === "demo" ? "demo" : "paid",
    plan_id: value,
  });

  const applyPlanPreset = (value: PlanType) => {
    setPlanType(value);
    if (value === "custom") return;

    const limits = PLAN_LIMITS[value];
    setFormData((prev) => ({
      ...prev,
      maxPhotos: limits.maxPhotos,
      allowVideoRecording: limits.allowVideoRecording,
      maxVideos: limits.maxVideos,
      maxVideoDuration: "15",
      allowAudioRecording: limits.allowAudioRecording,
      maxAudios: limits.maxAudios,
      maxAudioDuration: "30",
    }));
  };

  const hasValidDateTimeParts = (dateValue: string, timeValue: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue) && /^\d{2}:\d{2}$/.test(timeValue);

  const toSafeUtc = (dateValue: string, timeValue: string, timezone: string) => {
    if (!hasValidDateTimeParts(dateValue, timeValue)) return null;
    const parsed = fromZonedTime(`${dateValue}T${timeValue}:00`, timezone);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const timezoneOffsetLabel = formatTimezoneOffset(formData.timezone);

  const isMissingGalleryAttachmentColumnsError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
    const details = "details" in error ? String((error as { details?: unknown }).details || "") : "";
    const hint = "hint" in error ? String((error as { hint?: unknown }).hint || "") : "";
    const combined = `${message} ${details} ${hint}`.toLowerCase();
    return combined.includes("allow_image_attachment") || combined.includes("allow_video_attachment");
  };

  const getEventQrUrl = (id: string) => {
    const storedQrUrl = getQrImageUrlFromLimits(formData.limitsJson) || localStorage.getItem(`event-qr-url-${id}`);
    if (storedQrUrl) return storedQrUrl;
    if (!isNuevoEventoDemo2(formData.limitsJson)) return null;
    return supabase.storage.from("event-photos").getPublicUrl(`event-qr/qr-${id}.png`).data.publicUrl;
  };

  const loadEventMediaCounts = async (id: string) => {
    try {
      const [photosRes, videosRes, audiosRes] = await Promise.all([
        supabase
          .from("photos")
          .select("id", { count: "exact", head: true })
          .eq("event_id", id),
        supabase
          .from("videos")
          .select("id", { count: "exact", head: true })
          .eq("event_id", id),
        supabase
          .from("audios")
          .select("id", { count: "exact", head: true })
          .eq("event_id", id),
      ]);

      setMediaCounts({
        photos: photosRes.error ? 0 : Number(photosRes.count ?? 0),
        videos: videosRes.error ? 0 : Number(videosRes.count ?? 0),
        audios: audiosRes.error ? 0 : Number(audiosRes.count ?? 0),
      });
    } catch (error) {
      console.error("Error loading event media counts:", error);
      setMediaCounts({ photos: 0, videos: 0, audios: 0 });
    }
  };

  const handleDownloadQR = async () => {
    if (!eventId) return;
    try {
      const qrUrl = getEventQrUrl(eventId);
      if (!qrUrl) {
        const qrBlob = await generateQrBlob(eventUrl);
        if (!qrBlob) throw new Error("QR_GENERATION_FAILED");
        const link = document.createElement("a");
        link.download = `qr-${formData.name || "evento"}.png`;
        link.href = URL.createObjectURL(qrBlob);
        link.click();
        return;
      }
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("QR_NOT_FOUND");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.download = `qr-${formData.name || "evento"}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
    } catch (error) {
      console.error("Error downloading QR:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.downloadQrError"),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Check authentication - demo mode bypasses auth
    const checkAuth = async () => {
      if (adminEventId) {
        if (isEditing && eventId === adminEventId) {
          loadEvent();
          return;
        }
        navigateWithoutUnsavedPrompt(`${pathPrefix}/event-management`);
        return;
      }
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
        navigate(`${pathPrefix}/admin-login`);
        return;
      }
      setIsSuperAdmin((session.user?.email || "").toLowerCase() === "revelao.cam@gmail.com");
      if (isEditing) {
        loadEvent();
      } else {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, isDemoMode, isEditing, eventId, adminEventId]);

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
      setEventNumber(event.event_number ?? null);
      const demoContact = getDemoContactFromLimits(event.limits_json);
      const eventTz = event.timezone || "Europe/Madrid";
      const uploadStartDate = event.upload_start_time ? toZonedTime(new Date(event.upload_start_time), eventTz) : new Date();
      const uploadEndDate = event.upload_end_time ? toZonedTime(new Date(event.upload_end_time), eventTz) : new Date();
      const revealDate = toZonedTime(new Date(event.reveal_time), eventTz);
      const expiryDate = event.expiry_date ? toZonedTime(new Date(event.expiry_date), eventTz) : null;
      
      const qrPasswordSettings = getEventQrPasswordSettings(event.limits_json);

      const loadedFormData = {
        name: event.name,
        password: event.password_hash,
        adminPassword: event.admin_password || "",
        qrPasswordEnabled: qrPasswordSettings.enabled,
        qrPassword: "",
        qrPasswordHash: qrPasswordSettings.hash,
        qrPasswordScope: qrPasswordSettings.scope,
        limitsJson: event.limits_json || null,
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
        fontFamily: (event as any).font_family || "dancing-script",
        fontSize: ((event as any).font_size || "text-3xl") as FontSizeOption,
        countryCode: event.country_code || "ES",
        timezone: event.timezone || "Europe/Madrid",
        language: event.language || "es",
        description: event.description || "",
        expiryDate: expiryDate ? format(expiryDate, "yyyy-MM-dd") : "",
        expiryTime: expiryDate ? format(expiryDate, "HH:mm") : "23:59",
        expiryRedirectUrl: event.expiry_redirect_url || "",
        allowPhotoDeletion: (event as any).allow_photo_deletion !== false,
        allowPhotoSharing: (event as any).allow_photo_sharing !== false,
        showLegalText: (event as any).show_legal_text === true,
        legalTextType: ((event as any).legal_text_type || "default") as "default" | "custom",
        customTermsText: (event as any).custom_terms_text || "",
        customPrivacyText: (event as any).custom_privacy_text || "",
        galleryViewMode: ((event as any).gallery_view_mode || "normal") as "normal" | "grid",
        likeCountingEnabled: (event as any).like_counting_enabled === true,
        allowVideoRecording: (event as any).allow_video_recording === true,
        maxVideos: event.max_videos ? String(event.max_videos) : "",
        maxVideoDuration: event.max_video_duration ? String(event.max_video_duration) : "15",
        allowAudioRecording: (event as any).allow_audio_recording === true,
        maxAudios: event.max_audios ? String(event.max_audios) : "",
        maxAudioDuration: event.max_audio_duration ? String(event.max_audio_duration) : "30",
        allowImageAttachment:
          (event as any).allow_image_attachment === true ||
          (event as any).allow_video_attachment === true,
        allowVideoAttachment:
          (event as any).allow_image_attachment === true ||
          (event as any).allow_video_attachment === true,
        headerStyle: ((event as any).header_style || "modern") as HeaderStyle,
      };
      await loadEventMediaCounts(event.id);

      const resolvedPlanType =
        event.plan_id === "demo" || event.max_photos === 10 ? "demo" :
        event.plan_id === "small" || event.max_photos === 200 ? "small" :
        event.plan_id === "medium" || event.plan_id === "large" || event.max_photos === 1200 ? "medium" :
        event.plan_id === "xxl" ? "xxl" :
        event.max_photos == null ? "xxl" :
        "custom";
      setFormData(loadedFormData);
      setPlanType(resolvedPlanType);
      setSavedEditSnapshot(getEditSnapshot(loadedFormData, resolvedPlanType));

      if ((await supabase.auth.getSession()).data.session?.user?.email?.toLowerCase() === "revelao.cam@gmail.com") {
        try {
          const { data: ownerPayload } = await supabase.functions.invoke(`admin-events?eventId=${eventId}`, {
            method: "GET",
          });
          const ownerEvent = ownerPayload?.events?.[0];
          setOwnerEmail(ownerEvent?.owner_email || demoContact.email);
          setOwnerPhone(ownerEvent?.owner_phone || demoContact.phone);
        } catch (error) {
          console.error("Error loading owner info:", error);
          setOwnerEmail(demoContact.email);
          setOwnerPhone(demoContact.phone);
        }
      }
    } catch (error) {
      console.error("Error loading event:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("form.loadError"),
        variant: "destructive",
      });
      navigate(`${pathPrefix}/event-management`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!eventId || !galleryPreviewOpen) return;
    loadEventMediaCounts(eventId);
  }, [eventId, galleryPreviewOpen]);

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
        title: t("form.errorTitle"),
        description: t("form.uploadError"),
        variant: "destructive",
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const openBackgroundAdjustModal = async (file: File) => {
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setPendingBackgroundSrc(src);
    setBackgroundAdjustX(50);
    setBackgroundAdjustY(20);
    setBackgroundAdjustZoom(1);
    setBackgroundAdjustOpen(true);
  };

  const applyBackgroundAdjust = async () => {
    if (!pendingBackgroundSrc) return;

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
        img.src = pendingBackgroundSrc;
      });

      // Header cover framing (same visual proportion used in Camera/Gallery header).
      const targetWidth = 1080;
      const targetHeight = 1170;
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar el editor de imagen");

      const baseScale = Math.max(targetWidth / image.width, targetHeight / image.height);
      const drawWidth = image.width * baseScale * backgroundAdjustZoom;
      const drawHeight = image.height * baseScale * backgroundAdjustZoom;
      const maxOffsetX = Math.max(0, drawWidth - targetWidth);
      const maxOffsetY = Math.max(0, drawHeight - targetHeight);
      const drawX = -maxOffsetX * (backgroundAdjustX / 100);
      const drawY = -maxOffsetY * (backgroundAdjustY / 100);

      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (generatedBlob) => {
            if (!generatedBlob) {
              reject(new Error("No se pudo generar el recorte"));
              return;
            }
            resolve(generatedBlob);
          },
          "image/jpeg",
          0.92
        );
      });

      const croppedFile = new File([blob], `background-mobile-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      setFormData((prev) => ({
        ...prev,
        backgroundImage: croppedFile,
      }));
      setBackgroundAdjustOpen(false);
      setPendingBackgroundSrc(null);
    } catch (error) {
      console.error("Error adjusting background image:", error);
      toast({
        title: t("form.errorTitle"),
        description: "No se pudo ajustar la imagen de fondo.",
        variant: "destructive",
      });
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
        root.render(<QRCodeSVG value={eventUrl} size={qrSize} level="H" includeMargin />);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isSuperAdmin && !isEditing && !ownerEmailInput.trim()) {
        toast({
          title: t("form.errorTitle"),
          description: t("events.ownerEmailRequired"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const resolvedMaxPhotos = formData.maxPhotos;
      const effectiveAllowVideoRecording = formData.allowVideoRecording;
      const effectiveAllowAudioRecording = formData.allowAudioRecording;
      const effectiveMaxVideos = formData.maxVideos;
      const effectiveMaxAudios = formData.maxAudios;
      const parseOptionalPositiveInt = (value: string) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
      };
      const parseDuration = (value: string, fallback: number) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
      };
      const resolvedMaxVideos = parseOptionalPositiveInt(effectiveMaxVideos);
      const resolvedVideoDuration = parseDuration(formData.maxVideoDuration, 15);
      const resolvedMaxAudios = parseOptionalPositiveInt(effectiveMaxAudios);
      const resolvedAudioDuration = parseDuration(formData.maxAudioDuration, 30);
      // Backward-compatible with environments where max_videos/max_audios are NOT NULL.
      const maxVideosValue = effectiveAllowVideoRecording ? (resolvedMaxVideos ?? 0) : 0;
      const maxAudiosValue = effectiveAllowAudioRecording ? (resolvedMaxAudios ?? 0) : 0;
      const eventTz = formData.timezone;
      const uploadStartDateTime = toSafeUtc(formData.uploadStartDate, formData.uploadStartTime, eventTz);
      const uploadEndDateTime = toSafeUtc(formData.uploadEndDate, formData.uploadEndTime, eventTz);
      const revealDateTime = toSafeUtc(formData.revealDate, formData.revealTime, eventTz);
      if (!uploadStartDateTime || !uploadEndDateTime || !revealDateTime) {
        toast({
          title: t("form.errorTitle"),
          description: t("form.errorDesc"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      if (formData.qrPasswordEnabled && !formData.qrPassword.trim() && !formData.qrPasswordHash) {
        toast({
          title: t("form.errorTitle"),
          description: "Introduce una contraseña para activar el acceso protegido por QR.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      if (formData.qrPasswordEnabled && !formData.qrPasswordScope.camera && !formData.qrPasswordScope.gallery) {
        toast({
          title: t("form.errorTitle"),
          description: "Elige si la contraseña se pedirá al echar fotos, al verlas o en ambas.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      const qrPasswordHashValue = formData.qrPasswordEnabled
        ? formData.qrPassword.trim()
          ? await hashPassword(formData.qrPassword.trim())
          : formData.qrPasswordHash
        : null;
      let limitsJsonValue = withEventQrPasswordSettings(
        formData.limitsJson,
        formData.qrPasswordEnabled,
        qrPasswordHashValue,
        formData.qrPasswordScope
      );
      if (!isEditing) {
        const limitsRecord =
          limitsJsonValue && typeof limitsJsonValue === "object" && !Array.isArray(limitsJsonValue)
            ? { ...(limitsJsonValue as Record<string, Json>) }
            : {};
        limitsRecord.admin_event_tab = "new";
        limitsJsonValue = limitsRecord;
      }

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

      const parsedExpiry = formData.expiryDate
        ? toSafeUtc(formData.expiryDate, formData.expiryTime, eventTz)
        : null;
      const expiryDateTime = parsedExpiry ? parsedExpiry.toISOString() : null;

      if (isEditing && eventId) {
        const { error } = await supabase
          .from("events")
          .update({
            name: formData.name,
            password_hash: formData.password,
            admin_password: formData.adminPassword || null,
            limits_json: limitsJsonValue,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: isRestrictedAdmin ? 10 : (resolvedMaxPhotos ? parseInt(resolvedMaxPhotos) : null),
            ...(isSuperAdmin ? getPlanPersistence(planType) : {}),
            custom_image_url: customImageUrl,
            background_image_url: backgroundImageUrl,
            filter_type: formData.filterType,
            font_family: formData.fontFamily,
            font_size: formData.fontSize,
            country_code: formData.countryCode,
            timezone: formData.timezone,
            language: formData.language,
            description: formData.description || null,
            expiry_date: expiryDateTime,
            expiry_redirect_url: formData.expiryRedirectUrl || null,
            allow_photo_deletion: formData.allowPhotoDeletion,
            allow_photo_sharing: formData.allowPhotoSharing,
            show_legal_text: formData.showLegalText,
            legal_text_type: formData.showLegalText ? formData.legalTextType : 'default',
            custom_terms_text: formData.legalTextType === 'custom' ? (formData.customTermsText || null) : null,
            custom_privacy_text: formData.legalTextType === 'custom' ? (formData.customPrivacyText || null) : null,
            gallery_view_mode: formData.galleryViewMode,
            like_counting_enabled: formData.likeCountingEnabled,
            allow_video_recording: effectiveAllowVideoRecording,
            max_videos: maxVideosValue,
            max_video_duration: resolvedVideoDuration,
            allow_audio_recording: effectiveAllowAudioRecording,
            max_audios: maxAudiosValue,
            max_audio_duration: resolvedAudioDuration,
            allow_image_attachment: formData.allowImageAttachment,
            allow_video_attachment: formData.allowImageAttachment,
            header_style: formData.headerStyle,
          } as any)
          .eq("id", eventId);

        if (error) throw error;

        toast({
          title: t("form.updateTitle"),
          description: t("form.updateDesc"),
        });
        navigate(`${pathPrefix}/event-management`);
      } else if (isSuperAdmin && !isEditing) {
        const payload = {
          ownerEmail: ownerEmailInput.trim(),
          event: {
            name: formData.name,
            password_hash: formData.password,
            admin_password: formData.adminPassword || "",
            limits_json: limitsJsonValue,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: resolvedMaxPhotos ? parseInt(resolvedMaxPhotos) : null,
            custom_image_url: customImageUrl,
            background_image_url: backgroundImageUrl,
            filter_type: formData.filterType,
            font_family: formData.fontFamily,
            font_size: formData.fontSize,
            country_code: formData.countryCode,
            timezone: formData.timezone,
            language: formData.language,
            description: formData.description || null,
            expiry_date: expiryDateTime,
            expiry_redirect_url: formData.expiryRedirectUrl || null,
            allow_photo_deletion: formData.allowPhotoDeletion,
            allow_photo_sharing: formData.allowPhotoSharing,
            show_legal_text: formData.showLegalText,
            legal_text_type: formData.showLegalText ? formData.legalTextType : 'default',
            custom_terms_text: formData.legalTextType === 'custom' ? (formData.customTermsText || null) : null,
            custom_privacy_text: formData.legalTextType === 'custom' ? (formData.customPrivacyText || null) : null,
            gallery_view_mode: formData.galleryViewMode,
            like_counting_enabled: formData.likeCountingEnabled,
            allow_video_recording: effectiveAllowVideoRecording,
            max_videos: maxVideosValue,
            max_video_duration: resolvedVideoDuration,
            allow_audio_recording: effectiveAllowAudioRecording,
            max_audios: maxAudiosValue,
            max_audio_duration: resolvedAudioDuration,
            allow_image_attachment: formData.allowImageAttachment,
            allow_video_attachment: formData.allowImageAttachment,
            header_style: formData.headerStyle,
            ...getPlanPersistence(planType),
          },
        };

        const { data: created, error } = await supabase.functions.invoke("admin-create-event", {
          method: "POST",
          body: payload,
        });

        if (error) throw error;
        if (!created?.event) {
          throw new Error("Missing event");
        }

        const createdEvent = created.event;
        const { error: markNewError } = await supabase
          .from("events")
          .update({ limits_json: limitsJsonValue } as any)
          .eq("id", createdEvent.id);
        if (markNewError) throw markNewError;
        const eventUrl = `https://acceso.revelao.cam/events/${createdEvent.password_hash}`;
        const qrUrl = await uploadQrImage(eventUrl, createdEvent.id);
        if (qrUrl) {
          localStorage.setItem(`event-qr-url-${createdEvent.id}`, qrUrl);
        }

        toast({
          title: t("form.createTitle"),
          description: t("form.createDesc"),
        });

        navigateWithoutUnsavedPrompt(`${pathPrefix}/event-management`, {
          state: {
            createdEvent: {
              id: createdEvent.id,
              name: createdEvent.name,
              password_hash: createdEvent.password_hash,
              upload_start_time: createdEvent.upload_start_time,
              upload_end_time: createdEvent.upload_end_time,
              reveal_time: createdEvent.reveal_time,
              max_photos: createdEvent.max_photos,
              max_videos: createdEvent.max_videos,
              max_audios: createdEvent.max_audios,
              owner_email: createdEvent.owner_email || ownerEmailInput.trim(),
            },
          },
        });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newEvent, error } = await supabase.from("events").insert({
          name: formData.name,
          password_hash: formData.password,
          admin_password: formData.adminPassword || null,
          limits_json: limitsJsonValue,
          upload_start_time: uploadStartDateTime.toISOString(),
          upload_end_time: uploadEndDateTime.toISOString(),
          reveal_time: revealDateTime.toISOString(),
          max_photos: resolvedMaxPhotos ? parseInt(resolvedMaxPhotos) : (isDemoMode ? 30 : null),
          custom_image_url: customImageUrl,
          background_image_url: backgroundImageUrl,
          filter_type: formData.filterType,
          font_family: formData.fontFamily,
          font_size: formData.fontSize,
          is_demo: isDemoMode || planType === "demo",
          type: isDemoMode || planType === "demo" ? "demo" : "paid",
          plan_id: isDemoMode ? "demo" : planType,
          owner_id: user?.id || null,
          country_code: formData.countryCode,
          timezone: formData.timezone,
          language: formData.language,
          description: formData.description || null,
          expiry_date: expiryDateTime,
          expiry_redirect_url: formData.expiryRedirectUrl || null,
          allow_photo_deletion: formData.allowPhotoDeletion,
          allow_photo_sharing: formData.allowPhotoSharing,
          show_legal_text: formData.showLegalText,
          legal_text_type: formData.showLegalText ? formData.legalTextType : 'default',
          custom_terms_text: formData.legalTextType === 'custom' ? (formData.customTermsText || null) : null,
          custom_privacy_text: formData.legalTextType === 'custom' ? (formData.customPrivacyText || null) : null,
          gallery_view_mode: formData.galleryViewMode,
          like_counting_enabled: formData.likeCountingEnabled,
          allow_video_recording: effectiveAllowVideoRecording,
          max_videos: maxVideosValue,
          max_video_duration: resolvedVideoDuration,
          allow_audio_recording: effectiveAllowAudioRecording,
          max_audios: maxAudiosValue,
          max_audio_duration: resolvedAudioDuration,
          allow_image_attachment: formData.allowImageAttachment,
          allow_video_attachment: formData.allowImageAttachment,
          header_style: formData.headerStyle,
        } as any).select().single();

        if (error) throw error;

        if (newEvent) {
          await notifyAdminNewEvent(newEvent);
          const eventUrl = `https://acceso.revelao.cam/events/${newEvent.password_hash}`;
          const qrUrl = await uploadQrImage(eventUrl, newEvent.id);
          if (qrUrl) {
            localStorage.setItem(`event-qr-url-${newEvent.id}`, qrUrl);
          }
        }

        toast({
          title: t("form.createTitle"),
          description: t("form.createDesc"),
        });

        navigateWithoutUnsavedPrompt(`${pathPrefix}/event-management`);
      }
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: t("form.errorTitle"),
        description: isMissingGalleryAttachmentColumnsError(error)
          ? "Falta aplicar la migracion de Supabase para los adjuntos desde galeria. Ejecuta la migracion 20260325120000_add_gallery_attachment_options.sql y vuelve a intentarlo."
          : isEditing
          ? t("form.updateError")
          : t("form.createError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventId) return;
    if (!confirm(t("events.confirmDelete"))) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;

      toast({
        title: t("events.deleteTitle"),
        description: t("events.deleteDesc"),
      });
      navigateWithoutUnsavedPrompt(`${pathPrefix}/event-management`);
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.deleteError"),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!isSuperAdmin || isEditing) return;
    setFormData((prev) =>
      prev.customImageUrl
        ? prev
        : { ...prev, customImageUrl: isDemoMode ? defaultDemoLogo : defaultQrLogo }
    );
  }, [isSuperAdmin, isEditing, isDemoMode]);

  useEffect(() => {
    if (!isSuperAdmin || isEditing || planType === "custom") return;
    const limits = PLAN_LIMITS[planType];
    setFormData((prev) => {
      if (prev.maxPhotos || prev.maxVideos || prev.maxAudios) return prev;
      return {
        ...prev,
        maxPhotos: limits.maxPhotos,
        allowVideoRecording: limits.allowVideoRecording,
        maxVideos: limits.maxVideos,
        maxVideoDuration: "15",
        allowAudioRecording: limits.allowAudioRecording,
        maxAudios: limits.maxAudios,
        maxAudioDuration: "30",
      };
    });
  }, [isSuperAdmin, isEditing, planType]);

  const getExpiryDays = () => {
    if (planType === "custom") return null;
    if (formData.maxPhotos === "10" || isDemoMode || planType === "demo") return 90;
    if (formData.maxPhotos === "200") return 20;
    if (formData.maxPhotos === "1200") return 60;
    return 90;
  };

  useEffect(() => {
    if (!formData.revealDate) return;
    const expiryDays = getExpiryDays();
    if (expiryDays === null) {
      // In custom plan, expiry is manually managed by superadmin.
      return;
    }
    const eventTz = formData.timezone;
    const revealBase = fromZonedTime(`${formData.revealDate}T00:00:00`, eventTz);
    if (Number.isNaN(revealBase.getTime())) return;
    const expiryDate = formatInTimeZone(addDays(revealBase, expiryDays), eventTz, "yyyy-MM-dd");
    setFormData((prev) =>
      prev.expiryDate === expiryDate && prev.expiryTime === "23:59"
        ? prev
        : { ...prev, expiryDate, expiryTime: "23:59" }
    );
  }, [formData.revealDate, formData.timezone, formData.maxPhotos, planType, isDemoMode]);

  if (isLoading) {
    return (
      <div className="admin-demo2-shell min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("form.loading")}</p>
      </div>
    );
  }

  const showGalleryAttachmentSettings =
    isSuperAdmin &&
    !isDemoEvent &&
    (isEditing || planType === "xxl");

  const activeFormStepIndex = EVENT_FORM_STEPS.findIndex((step) => step.value === activeFormStep);
  const isLastCreationStep = activeFormStepIndex === EVENT_FORM_STEPS.length - 1;
  const goToNextCreationStep = () => {
    const nextIndex = Math.min(activeFormStepIndex + 1, EVENT_FORM_STEPS.length - 1);
    setMaxUnlockedFormStep((current) => Math.max(current, nextIndex));
    setActiveFormStep(EVENT_FORM_STEPS[nextIndex].value);
  };
  const goToPreviousCreationStep = () => {
    const prevIndex = Math.max(activeFormStepIndex - 1, 0);
    setActiveFormStep(EVENT_FORM_STEPS[prevIndex].value);
  };
  const handleFormStepChange = (value: string) => {
    const nextStep = value as EventFormStep;
    const nextIndex = EVENT_FORM_STEPS.findIndex((step) => step.value === nextStep);
    if (nextIndex < 0) return;
    if (!isEditing && nextIndex > maxUnlockedFormStep) return;
    setActiveFormStep(nextStep);
  };

  const eventHeaderTools = isEditing && eventId ? (
    <Card className="p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {(() => {
            const qrUrl = getEventQrUrl(eventId);
            return (
              <div
                className="shrink-0 cursor-pointer rounded-lg border border-border bg-white p-2"
                onClick={() => setQrPreview({ src: qrUrl || undefined, value: eventUrl })}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setQrPreview({ src: qrUrl || undefined, value: eventUrl });
                  }
                }}
              >
                {qrUrl ? (
                  <img src={qrUrl} alt="QR" className="h-20 w-20" />
                ) : (
                  <QRCodeSVG value={eventUrl} size={80} />
                )}
              </div>
            );
          })()}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{formData.name || t("form.namePreview")}</p>
            <a
              href={eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {eventUrl}
            </a>
            {isSuperAdmin && (eventNumber || ownerEmail || ownerPhone) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ownerEmail && (
                  <p>
                    <span className="font-medium text-foreground">{t("events.ownerEmail")}:</span>{" "}
                    {ownerEmail}
                  </p>
                )}
                {eventNumber ? (
                  <p>
                    <span className="font-medium text-foreground">ID:</span>{" "}
                    {eventNumber}
                  </p>
                ) : null}
                {ownerPhone && (
                  <p>
                    <span className="font-medium text-foreground">{t("events.ownerPhone")}:</span>{" "}
                    {ownerPhone}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-[44px_1fr_44px] gap-2 md:min-w-[360px]">
          <Button
            variant="outline"
            size="icon"
            onClick={handleDownloadQR}
            aria-label={t("events.downloadQrAction")}
            title={t("events.downloadQrAction")}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-auto px-3 py-2 text-xs font-medium text-foreground gap-3 justify-center flex-nowrap"
            onClick={() => setGalleryPreviewOpen(true)}
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Camera className="w-3.5 h-3.5" />
              {mediaCounts.photos}/{mediaLimits.photos}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Video className="w-3.5 h-3.5" />
              {mediaCounts.videos}/{mediaLimits.videos}
            </span>
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Mic className="w-3.5 h-3.5" />
              {mediaCounts.audios}/{mediaLimits.audios}
            </span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(eventUrl, "_blank")}
            aria-label={t("events.accessLink")}
            title={t("events.accessLink")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  ) : null;

  return (
    <div
      className="admin-demo2-shell min-h-screen bg-background p-4 md:p-6 overflow-x-hidden"
      data-scroll-container
    >
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => requestLeave(() => navigate(`${pathPrefix}/event-management`))}
            className="rounded-full"
            title={t("form.back")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground"
            data-scroll-anchor
          >
            {isEditing ? t("form.title.edit") : t("form.title.new")}
          </h1>
          {isEditing && isDemoEvent && (
            <span className="text-xs font-semibold uppercase tracking-wide bg-[#f06a5f]/10 text-[#f06a5f] px-2 py-1 rounded-full">
              {t("events.demoBadge")}
            </span>
          )}
        </div>
        {eventHeaderTools}

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          {/* Form Column */}
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={activeFormStep} onValueChange={handleFormStepChange} className="space-y-6">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-full bg-muted/50 p-1 sm:grid-cols-4">
                {EVENT_FORM_STEPS.map((step, index) => (
                  <TabsTrigger
                    type="button"
                    key={step.value}
                    value={step.value}
                    disabled={!isEditing && index > maxUnlockedFormStep}
                    className="rounded-full data-[state=active]:!bg-foreground data-[state=active]:!text-background data-[state=active]:shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {step.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="general" className="mt-0 space-y-6">
            {isSuperAdmin && !isEditing && (
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">{t("events.ownerEmail")}</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={ownerEmailInput}
                  onChange={(e) => setOwnerEmailInput(e.target.value)}
                  placeholder="email@dominio.com"
                  required
                />
              </div>
            )}

            {isSuperAdmin && (
              <div className="space-y-2">
                <Label htmlFor="planType">{t("events.planType")}</Label>
                <select
                  id="planType"
                  value={planType}
                  onChange={(e) => applyPlanPreset(e.target.value as PlanType)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="demo">{t("events.planDemo")}</option>
                  <option value="small">{t("events.planSmall")}</option>
                  <option value="medium">{t("events.planMedium")}</option>
                  <option value="xxl">{t("events.planXl")}</option>
                  <option value="custom">{t("events.planCustom")}</option>
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">{t("form.name")}</Label>
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
              <Label>{t("form.font")}</Label>
              <FontSelect
                value={formData.fontFamily}
                onChange={(fontFamily) =>
                  setFormData({ ...formData, fontFamily })
                }
                previewText={formData.name || t("form.namePreview")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("form.fontSize")}</Label>
              <FontSizeSelect
                value={formData.fontSize}
                onChange={(fontSize) =>
                  setFormData({ ...formData, fontSize })
                }
                previewText={formData.name || t("form.namePreview")}
                fontFamily={getEventFontFamily(formData.fontFamily)}
              />
              {t("form.fontHint") ? (
                <p className="text-xs text-muted-foreground">
                  {t("form.fontHint")}
                </p>
              ) : null}
            </div>

            {(!isEditing || isSuperAdmin) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("form.password")}</Label>
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
                    {t("form.adminPassword")}
                  </Label>
                  <Input
                    id="adminPassword"
                    type="text"
                    value={formData.adminPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, adminPassword: e.target.value })
                    }
                    placeholder={t("form.optional")}
                  />
                </div>
              </>
            )}

              </TabsContent>

              <TabsContent value="space" className="mt-0 space-y-6">

            {!isSuperAdmin && (
            <div className="space-y-2">
              <Label htmlFor="maxPhotos">
                {t("form.maxPhotos")}
              </Label>
                <Input
                  id="maxPhotos"
                  type="number"
                  min="1"
                  value={formData.maxPhotos}
                  onChange={(e) =>
                    setFormData({ ...formData, maxPhotos: e.target.value })
                  }
                  placeholder={isDemoMode ? t("form.maxPhotosDemoDefault") : t("form.maxPhotosUnlimited")}
                  disabled={!isSuperAdmin}
                  className={!isSuperAdmin ? "bg-muted cursor-not-allowed" : ""}
                />
              {!isSuperAdmin && isDemoEvent && (
                <p className="text-xs text-muted-foreground">
                  {t("form.maxPhotosFixedDemo")}
                </p>
              )}
              {isDemoMode && !isRestrictedAdmin && (
                <p className="text-xs text-muted-foreground">
                  {t("form.maxPhotosDemoHint")}
                </p>
              )}
            </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="filterType">
                {t("form.filterLabel")}
              </Label>
              <div className="md:hidden">
                <Carousel opts={{ align: "start" }} className="w-full">
                  <CarouselContent className="ml-0">
                    {FILTER_ORDER.map((filter) => {
                      const isActive = formData.filterType === filter;
                      return (
                        <CarouselItem key={filter} className="basis-[70%] sm:basis-1/3 pl-0 pr-3">
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setFormData({ ...formData, filterType: filter })}
                            className="w-full text-left"
                          >
                            <div
                              className={`relative overflow-hidden rounded-lg border ${
                                isActive
                                  ? "border-foreground ring-2 ring-foreground/20"
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
                            <p className={`mt-2 text-xs ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
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
                            ? "border-foreground ring-2 ring-foreground/20"
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
                      <p className={`mt-2 text-xs ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {t(`form.filter.${filter}`)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundImage">
                {t("form.backgroundImageLabel")}
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                {t("form.backgroundImageHint")}
              </p>
              {formData.backgroundImageUrl && !formData.backgroundImage && (
                <div className="mb-2 relative inline-block">
                  <img 
                    src={formData.backgroundImageUrl} 
                    alt={t("form.preview")}
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
                    alt={t("form.preview")}
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
                onChange={async (e) => {
                  const input = e.currentTarget;
                  const file = input.files?.[0];
                  if (file) {
                    await openBackgroundAdjustModal(file);
                    input.value = "";
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customImage">
                {t("form.customImageLabel")}
              </Label>
              <div className="text-xs text-muted-foreground mb-2">
                {t("form.customImageHint")}
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
              <Label htmlFor="description">
                {t("form.descriptionLabel")}
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("form.descriptionPlaceholder")}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t("form.descriptionHint")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("form.countryQuestion")}</Label>
                <CountrySelect
                  value={formData.countryCode}
                  onChange={(countryCode, timezone) =>
                    setFormData({ ...formData, countryCode, timezone })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("form.countryHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("form.language")}</Label>
                <LanguageSelect
                  value={formData.language as Language}
                  onChange={(language) =>
                    setFormData({ ...formData, language })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t("form.languageHint")}
                </p>
              </div>
            </div>

              </TabsContent>

              <TabsContent value="dates" className="mt-0 space-y-6">

            <div className="space-y-2">
              <Label className="text-base font-semibold">{t("form.uploadSection")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uploadStartDate">{t("form.uploadStartDate")}</Label>
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
                  <Label htmlFor="uploadStartTime">
                    {t("form.uploadStartTime")}
                  </Label>
                  <Input
                    id="uploadStartTime"
                    type="time"
                    value={formData.uploadStartTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        uploadStartTime: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uploadEndDate">{t("form.uploadEndDate")}</Label>
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
                  <Label htmlFor="uploadEndTime">
                    {t("form.uploadEndTime")}
                  </Label>
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
              {formData.countryCode !== "ES" && formData.uploadStartDate && formData.uploadStartTime && formData.uploadEndDate && formData.uploadEndTime && (
                <p className="text-xs text-muted-foreground">
                  🇪🇸 {t("events.inSpain")}: {(() => {
                    const eventTz = formData.timezone;
                    const spainTz = "Europe/Madrid";
                    const startUtc = toSafeUtc(formData.uploadStartDate, formData.uploadStartTime, eventTz);
                    const endUtc = toSafeUtc(formData.uploadEndDate, formData.uploadEndTime, eventTz);
                    if (!startUtc || !endUtc) return "";
                    const startInSpain = formatInTimeZone(startUtc, spainTz, "dd/MM/yyyy HH:mm");
                    const endInSpain = formatInTimeZone(endUtc, spainTz, "dd/MM/yyyy HH:mm");
                    return `${startInSpain} - ${endInSpain}`;
                  })()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">{t("form.revealSection")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revealDate">{t("form.revealDateLabel")}</Label>
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
                  <Label htmlFor="revealTime">
                    {t("form.revealTimeLabel")}
                  </Label>
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
              {formData.countryCode !== "ES" && formData.revealDate && formData.revealTime && (
                <p className="text-xs text-muted-foreground">
                  🇪🇸 {t("events.inSpain")}: {(() => {
                    const eventTz = formData.timezone;
                    const spainTz = "Europe/Madrid";
                    const revealUtc = toSafeUtc(formData.revealDate, formData.revealTime, eventTz);
                    if (!revealUtc) return "";
                    return formatInTimeZone(revealUtc, spainTz, "dd/MM/yyyy HH:mm");
                  })()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">{t("form.expirySection")}</Label>
              <div className="text-xs text-muted-foreground mb-2">
                {t("form.expiryHint")}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("form.expiryManualNote")}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">{t("form.expiryDateLabel")}</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryDate: e.target.value })
                    }
                    disabled={!isSuperAdmin || planType !== "custom"}
                  />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiryTime">
                      {t("form.expiryTimeLabel")}
                    </Label>
                  <Input
                    id="expiryTime"
                    type="time"
                    value={formData.expiryTime}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryTime: e.target.value })
                    }
                    disabled={!isSuperAdmin || planType !== "custom"}
                  />
                  </div>
                </div>
                {formData.countryCode !== "ES" && formData.expiryDate && formData.expiryTime && (
                  <p className="text-xs text-muted-foreground">
                    🇪🇸 {t("events.inSpain")}: {(() => {
                      const eventTz = formData.timezone;
                      const spainTz = "Europe/Madrid";
                      const expiryUtc = toSafeUtc(formData.expiryDate, formData.expiryTime, eventTz);
                      if (!expiryUtc) return "";
                      return formatInTimeZone(expiryUtc, spainTz, "dd/MM/yyyy HH:mm");
                    })()}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="expiryRedirectUrl">{t("form.expiryRedirectLabel")}</Label>
                  <Input
                    id="expiryRedirectUrl"
                    type="url"
                    value={formData.expiryRedirectUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryRedirectUrl: e.target.value })
                    }
                    placeholder={t("form.expiryRedirectPlaceholder")}
                  />
                </div>
              </div>
            </div>

              </TabsContent>

              <TabsContent value="options" className="mt-0 space-y-6">

            <div className="space-y-4 border-t border-border pt-4">
              <Label className="text-base font-semibold">{t("form.optionsSection")}</Label>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="qrPasswordEnabled">Proteger acceso por QR</Label>
                    <p className="text-xs text-muted-foreground">
                      Si se activa, los invitados tendrán que introducir esta contraseña antes de acceder al evento desde su QR.
                    </p>
                  </div>
                  <Switch
                    id="qrPasswordEnabled"
                    checked={formData.qrPasswordEnabled}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        qrPasswordEnabled: checked,
                        qrPassword: checked ? formData.qrPassword : "",
                        qrPasswordScope: checked
                          ? formData.qrPasswordScope
                          : { camera: true, gallery: true },
                      })
                    }
                  />
                </div>

                {formData.qrPasswordEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="qrPassword">
                        Contraseña del QR<span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="qrPassword"
                        type="text"
                        value={formData.qrPassword}
                        onChange={(e) =>
                          setFormData({ ...formData, qrPassword: e.target.value })
                        }
                        placeholder="Contraseña para invitados"
                        required={formData.qrPasswordEnabled}
                      />
                      {formData.qrPasswordHash && !formData.qrPassword ? (
                        <p className="text-xs text-muted-foreground">
                          Ya hay una contraseña configurada. Deja este campo vacío para conservarla.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Solicitar contraseña en</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-border"
                            checked={formData.qrPasswordScope.camera}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                qrPasswordScope: {
                                  ...formData.qrPasswordScope,
                                  camera: e.target.checked,
                                },
                              })
                            }
                          />
                          <span>
                            Echar fotos
                            <span className="block text-xs text-muted-foreground">Se pedirá antes de entrar a cámara.</span>
                          </span>
                        </label>
                        <label className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-border"
                            checked={formData.qrPasswordScope.gallery}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                qrPasswordScope: {
                                  ...formData.qrPasswordScope,
                                  gallery: e.target.checked,
                                },
                              })
                            }
                          />
                          <span>
                            Ver galería
                            <span className="block text-xs text-muted-foreground">Se pedirá antes de ver las fotos reveladas.</span>
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Cabecera en Camera/Gallery</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, headerStyle: "gradient" })}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      formData.headerStyle === "gradient"
                        ? "!border-foreground !bg-foreground !text-background shadow-sm"
                        : "bg-muted border-border hover:bg-muted/80"
                    }`}
                  >
                    Cabecera degradada
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, headerStyle: "modern" })}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      formData.headerStyle === "modern"
                        ? "!border-foreground !bg-foreground !text-background shadow-sm"
                        : "bg-muted border-border hover:bg-muted/80"
                    }`}
                  >
                    Cabecera moderna
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allowPhotoDeletion">{t("form.allowDeletionLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("form.allowDeletionHint")}
                  </p>
                </div>
                <Switch
                  id="allowPhotoDeletion"
                  checked={formData.allowPhotoDeletion}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowPhotoDeletion: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="allowPhotoSharing">{t("form.allowSharingLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("form.allowSharingHint")}
                  </p>
                </div>
                <Switch
                  id="allowPhotoSharing"
                  checked={formData.allowPhotoSharing}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowPhotoSharing: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="likeCountingEnabled">{t("form.likeCountingLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("form.likeCountingHint")}
                  </p>
                </div>
                <Switch
                  id="likeCountingEnabled"
                  checked={formData.likeCountingEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, likeCountingEnabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showLegalText">{t("form.showLegalLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("form.showLegalHint")}
                  </p>
                </div>
                <Switch
                  id="showLegalText"
                  checked={formData.showLegalText}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, showLegalText: checked })
                  }
                />
              </div>

            {formData.showLegalText && (
              <div className="ml-4 space-y-4 border-l-2 border-border pl-4">
                <div className="space-y-2">
                  <Label>{t("form.legalTypeLabel")}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, legalTextType: "default" })}
                        className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                          formData.legalTextType === "default"
                            ? "!border-foreground !bg-foreground !text-background shadow-sm"
                            : "bg-muted border-border hover:bg-muted/80"
                        }`}
                      >
                        {t("form.legalTypeDefault")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, legalTextType: "custom" })}
                        className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                          formData.legalTextType === "custom"
                            ? "!border-foreground !bg-foreground !text-background shadow-sm"
                            : "bg-muted border-border hover:bg-muted/80"
                        }`}
                      >
                        {t("form.legalTypeCustom")}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formData.legalTextType === "default"
                        ? t("form.legalTypeHintDefault")
                        : t("form.legalTypeHintCustom")}
                    </p>
                  </div>

                  {formData.legalTextType === "custom" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="customTermsText">{t("form.customTermsLabel")}</Label>
                        <Textarea
                          id="customTermsText"
                          value={formData.customTermsText}
                          onChange={(e) =>
                            setFormData({ ...formData, customTermsText: e.target.value })
                          }
                          placeholder={t("form.customTermsPlaceholder")}
                          rows={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customPrivacyText">{t("form.customPrivacyLabel")}</Label>
                        <Textarea
                          id="customPrivacyText"
                          value={formData.customPrivacyText}
                          onChange={(e) =>
                            setFormData({ ...formData, customPrivacyText: e.target.value })
                          }
                          placeholder={t("form.customPrivacyPlaceholder")}
                          rows={8}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {isSuperAdmin && (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <div>
                  <Label className="text-base font-semibold">{t("form.mediaSection")}</Label>
                  <p className="text-xs text-muted-foreground">{t("form.mediaSectionHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPhotos">{t("form.maxPhotos")}</Label>
                  <Input
                    id="maxPhotos"
                    type="number"
                    min="1"
                    value={formData.maxPhotos}
                    onChange={(e) =>
                      setFormData({ ...formData, maxPhotos: e.target.value })
                    }
                    placeholder={t("form.maxPhotosUnlimited")}
                  />
                </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allowVideoRecording">{t("form.allowVideoUploadLabel")}</Label>
                        <p className="text-xs text-muted-foreground">{t("form.allowVideoUploadHint")}</p>
                      </div>
                      <Switch
                        id="allowVideoRecording"
                        checked={formData.allowVideoRecording}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, allowVideoRecording: checked })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="maxVideos">{t("form.maxVideosLabel")}</Label>
                        <Input
                          id="maxVideos"
                          type="number"
                          min={1}
                          placeholder={t("form.maxVideosPlaceholder")}
                          value={formData.maxVideos}
                          onChange={(e) =>
                            setFormData({ ...formData, maxVideos: e.target.value })
                          }
                          disabled={!formData.allowVideoRecording}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxVideoDuration">{t("form.videoDurationLabel")}</Label>
                        <Input
                          id="maxVideoDuration"
                          type="number"
                          min={5}
                          value={formData.maxVideoDuration}
                          onChange={(e) =>
                            setFormData({ ...formData, maxVideoDuration: e.target.value })
                          }
                          disabled={!formData.allowVideoRecording}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("form.videoDurationHint")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="allowAudioRecording">{t("form.allowAudioUploadLabel")}</Label>
                        <p className="text-xs text-muted-foreground">{t("form.allowAudioUploadHint")}</p>
                      </div>
                      <Switch
                        id="allowAudioRecording"
                        checked={formData.allowAudioRecording}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, allowAudioRecording: checked })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="maxAudios">{t("form.maxAudioLabel")}</Label>
                        <Input
                          id="maxAudios"
                          type="number"
                          min={1}
                          placeholder={t("form.maxAudioPlaceholder")}
                          value={formData.maxAudios}
                          onChange={(e) =>
                            setFormData({ ...formData, maxAudios: e.target.value })
                          }
                          disabled={!formData.allowAudioRecording}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxAudioDuration">{t("form.audioDurationLabel")}</Label>
                        <Input
                          id="maxAudioDuration"
                          type="number"
                          min={5}
                          value={formData.maxAudioDuration}
                          onChange={(e) =>
                            setFormData({ ...formData, maxAudioDuration: e.target.value })
                          }
                          disabled={!formData.allowAudioRecording}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("form.audioDurationHint")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {showGalleryAttachmentSettings && (
                    <div className="space-y-3 border-t border-border pt-4">
                      <div>
                        <Label className="text-sm font-semibold">Adjuntar</Label>
                        <p className="text-xs text-muted-foreground">
                          Permite a los invitados subir fotos o vídeos ya guardados en su movil. Solo se muestra al crear eventos Pro y despues puede editarse desde el detalle del evento.
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="allowImageAttachment">Activar opcion de adjuntar</Label>
                          <p className="text-xs text-muted-foreground">
                            Muestra un unico boton "Adjuntar" valido para fotos y vídeos desde la galeria del movil.
                          </p>
                        </div>
                        <Switch
                          id="allowImageAttachment"
                          checked={formData.allowImageAttachment}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              allowImageAttachment: checked,
                              allowVideoAttachment: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
              </div>
            )}

            {isEditing && !isSuperAdmin && (
              <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">Incluido en el plan</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fotos:{" "}
                  <span className="font-medium text-foreground">
                    {formData.maxPhotos || "Ilimitadas"}
                  </span>
                  {" · "}
                  Vídeos:{" "}
                  <span className="font-medium text-foreground">
                    {formData.allowVideoRecording ? (formData.maxVideos || "Ilimitados") : "No incluido"}
                  </span>
                  {" · "}
                  Audios:{" "}
                  <span className="font-medium text-foreground">
                    {formData.allowAudioRecording ? (formData.maxAudios || "Ilimitados") : "No incluido"}
                  </span>
                </p>
              </div>
            )}
          </div>

              </TabsContent>
            </Tabs>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  requestLeave(() => {
                    toast({
                      title: t("form.cancel"),
                      description: t("form.cancel"),
                    });
                    navigate(`${pathPrefix}/event-management`);
                  });
                }}
                className="w-full sm:w-auto"
              >
                {t("form.cancel")}
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteEvent}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("events.delete")}
                </Button>
              )}
              {!isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousCreationStep}
                  disabled={activeFormStepIndex === 0 || isSubmitting || uploadingImage}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Atrás
                </Button>
              )}
              {!isEditing && !isLastCreationStep ? (
                <Button
                  type="button"
                  className="w-full sm:flex-1"
                  onClick={goToNextCreationStep}
                  disabled={isSubmitting || uploadingImage}
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" className="w-full sm:flex-1" disabled={isSubmitting || uploadingImage}>
                  {uploadingImage
                    ? t("form.uploadingImage")
                    : isSubmitting
                      ? (isEditing ? t("form.updating") : t("form.creatingText"))
                      : (isEditing ? t("form.updateButton") : t("form.createButton"))
                  }
                </Button>
              )}
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
                  allowVideoRecording={formData.allowVideoRecording}
                  allowAudioRecording={formData.allowAudioRecording}
                  headerStyle={formData.headerStyle}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={leaveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
      >
        <DialogContent className="admin-demo2-shell max-w-md w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>¿Estás seguro de salir sin guardar?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en este evento. Si sales ahora, se perderán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={keepEditing}>
              No, editar
            </Button>
            <Button type="button" onClick={confirmLeaveWithoutSaving}>
              Sí, salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={backgroundAdjustOpen}
        onOpenChange={(open) => {
          setBackgroundAdjustOpen(open);
          if (!open) setPendingBackgroundSrc(null);
        }}
      >
        <DialogContent className="w-[95vw] max-w-xl p-4">
          <DialogHeader>
            <DialogTitle>Ajustar foto de portada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ajusta encuadre y zoom según el tamaño y la forma de la portada.
            </p>
            <div className="mx-auto w-[250px] max-w-full">
              <div className="overflow-hidden rounded-b-3xl border border-border aspect-[375/406] bg-black">
                {pendingBackgroundSrc ? (
                  <img
                    src={pendingBackgroundSrc}
                    alt="Previsualización de portada"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${backgroundAdjustX}% ${backgroundAdjustY}%`,
                      transform: `scale(${backgroundAdjustZoom})`,
                      transformOrigin: "center",
                    }}
                  />
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Zoom</Label>
                <Input
                  type="range"
                  min={1}
                  max={2.5}
                  step={0.01}
                  value={backgroundAdjustZoom}
                  onChange={(e) => setBackgroundAdjustZoom(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posición horizontal</Label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={backgroundAdjustX}
                  onChange={(e) => setBackgroundAdjustX(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posición vertical</Label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={backgroundAdjustY}
                  onChange={(e) => setBackgroundAdjustY(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBackgroundAdjustOpen(false);
                  setPendingBackgroundSrc(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={applyBackgroundAdjust}>
                Confirmar encuadre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {qrPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setQrPreview(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-3xl leading-none"
            aria-label="Cerrar"
            onClick={() => setQrPreview(null)}
          >
            ×
          </button>
          <div
            className="bg-white rounded-xl p-3"
            style={{ width: "min(90vw, 90vh)", height: "min(90vw, 90vh)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {qrPreview.src ? (
              <img
                src={qrPreview.src}
                alt="QR"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <QRCodeSVG value={qrPreview.value} size={1024} level="H" includeMargin />
              </div>
            )}
          </div>
        </div>
      )}

      {isEditing && eventId && (
        <GalleryPreviewModal
          open={galleryPreviewOpen}
          onOpenChange={setGalleryPreviewOpen}
          eventId={eventId}
          eventName={formData.name}
          eventDescription={formData.description}
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
          fontFamily={formData.fontFamily}
          fontSize={formData.fontSize}
          filterType={formData.filterType}
          allowPhotoSharing={formData.allowPhotoSharing}
        />
      )}
    </div>
  );
};

export default EventForm;
