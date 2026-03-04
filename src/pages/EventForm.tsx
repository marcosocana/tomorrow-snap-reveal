import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Trash2 } from "lucide-react";
import { addDays, format, subHours } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import FontSizeSelect, { FontSizeOption } from "@/components/FontSizeSelect";
import EventPreview from "@/components/EventPreview";
import { Language, getLanguageByCode } from "@/lib/translations";
import { getCountryByCode, getTimezoneOffset } from "@/lib/countries";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_ORDER, getFilterClass, getGrainClass } from "@/lib/photoFilters";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useAdminI18n } from "@/lib/adminI18n";
import { QRCodeSVG } from "qrcode.react";
import defaultQrLogo from "@/assets/marca_revelao_qr_evento.png";
import weddingPreview from "@/assets/testimonial-wedding.jpg";

// Background image - no size restrictions

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
  allow_video_recording?: boolean;
  max_videos?: number | null;
  max_video_duration?: number | null;
  allow_audio_recording?: boolean;
  max_audios?: number | null;
  max_audio_duration?: number | null;
}

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
  const [ownerEmailInput, setOwnerEmailInput] = useState("");
  const [qrPreview, setQrPreview] = useState<{ src?: string; value: string } | null>(null);
  const [planType, setPlanType] = useState<"demo" | "small" | "medium" | "xxl" | "custom">("demo");
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
      uploadStartDate: initialUploadStartDate,
      uploadStartTime: initialUploadStartTime,
      uploadEndDate: initialUploadEndDate,
      uploadEndTime: initialUploadEndTime,
      revealDate: initialRevealDate,
      revealTime: initialRevealTime,
      maxPhotos: isDemoMode ? "30" : "",
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
    };
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();
  const isDemoEvent = formData.maxPhotos === "10";
  const eventUrl = eventId ? `https://acceso.revelao.cam/events/${formData.password}` : "";

  const formatTimezoneOffset = (timezone: string) => {
    const offsetMinutes = getTimezoneOffset(timezone);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const minutes = String(absMinutes % 60).padStart(2, "0");
    return `GMT${sign}${hours}:${minutes}`;
  };
  const timezoneOffsetLabel = formatTimezoneOffset(formData.timezone);

  const getEventQrUrl = (id: string) =>
    localStorage.getItem(`event-qr-url-${id}`) ||
    supabase.storage
      .from("event-photos")
      .getPublicUrl(`event-qr/qr-${id}.png`).data.publicUrl;

  const handleDownloadQR = async () => {
    if (!eventId) return;
    try {
      const qrUrl = getEventQrUrl(eventId);
      const response = await fetch(qrUrl);
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
        navigate(`${pathPrefix}/event-management`);
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
      });

      const resolvedPlanType =
        event.max_photos === 10 ? "demo" :
        event.max_photos === 200 ? "small" :
        event.max_photos === 1200 ? "medium" :
        event.max_photos == null ? "custom" :
        "custom";
      setPlanType(resolvedPlanType);

      if ((await supabase.auth.getSession()).data.session?.user?.email?.toLowerCase() === "revelao.cam@gmail.com") {
        try {
          const { data: ownerPayload } = await supabase.functions.invoke(`admin-events?eventId=${eventId}`, {
            method: "GET",
          });
          const ownerEvent = ownerPayload?.events?.[0];
          setOwnerEmail(ownerEvent?.owner_email || null);
          setOwnerPhone(ownerEvent?.owner_phone || null);
        } catch (error) {
          console.error("Error loading owner info:", error);
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

      if (!isEditing) {
        const nowTz = toZonedTime(new Date(), formData.timezone);
        const todayStr = format(nowTz, "yyyy-MM-dd");
        const minStart = subHours(nowTz, 2);
        const startUtc = fromZonedTime(`${formData.uploadStartDate}T${formData.uploadStartTime}:00`, formData.timezone);
        if (formData.uploadStartDate < todayStr || startUtc < minStart) {
          toast({
            title: t("form.errorTitle"),
            description: "La fecha de inicio no puede ser anterior a hoy y la hora no puede ser anterior a 2 horas.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const planToMaxPhotos: Record<string, string> = {
        demo: "10",
        small: "200",
        medium: "1200",
        large: "1200",
        xxl: "",
      };
      const resolvedMaxPhotos =
        isSuperAdmin && !isEditing && planType !== "custom"
          ? planToMaxPhotos[planType]
          : formData.maxPhotos;
      const parseOptionalPositiveInt = (value: string) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
      };
      const parseDuration = (value: string, fallback: number) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
      };
      const resolvedMaxVideos = parseOptionalPositiveInt(formData.maxVideos);
      const resolvedVideoDuration = parseDuration(formData.maxVideoDuration, 15);
      const resolvedMaxAudios = parseOptionalPositiveInt(formData.maxAudios);
      const resolvedAudioDuration = parseDuration(formData.maxAudioDuration, 30);
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
            max_photos: isRestrictedAdmin ? 10 : (resolvedMaxPhotos ? parseInt(resolvedMaxPhotos) : null),
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
            allow_video_recording: formData.allowVideoRecording,
            max_videos: resolvedMaxVideos,
            max_video_duration: resolvedVideoDuration,
            allow_audio_recording: formData.allowAudioRecording,
            max_audios: resolvedMaxAudios,
            max_audio_duration: resolvedAudioDuration,
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
            allow_video_recording: formData.allowVideoRecording,
            max_videos: resolvedMaxVideos,
            max_video_duration: resolvedVideoDuration,
            allow_audio_recording: formData.allowAudioRecording,
            max_audios: resolvedMaxAudios,
            max_audio_duration: resolvedAudioDuration,
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
        const eventUrl = `https://acceso.revelao.cam/events/${createdEvent.password_hash}`;
        const qrUrl = await uploadQrImage(eventUrl, createdEvent.id);
        if (qrUrl) {
          localStorage.setItem(`event-qr-url-${createdEvent.id}`, qrUrl);
        }

        toast({
          title: t("form.createTitle"),
          description: t("form.createDesc"),
        });

        navigate(`${pathPrefix}/event-management`, {
          state: {
            createdEvent: {
              id: createdEvent.id,
              name: createdEvent.name,
              password_hash: createdEvent.password_hash,
              upload_start_time: createdEvent.upload_start_time,
              upload_end_time: createdEvent.upload_end_time,
              reveal_time: createdEvent.reveal_time,
              max_photos: createdEvent.max_photos,
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
          allow_video_recording: formData.allowVideoRecording,
          max_videos: resolvedMaxVideos,
          max_video_duration: resolvedVideoDuration,
          allow_audio_recording: formData.allowAudioRecording,
          max_audios: resolvedMaxAudios,
          max_audio_duration: resolvedAudioDuration,
        } as any).select().single();

        if (error) throw error;

        if (newEvent) {
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

        navigate(`${pathPrefix}/event-management`);
      }
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: t("form.errorTitle"),
        description: isEditing ? t("form.updateError") : t("form.createError"),
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
      navigate(`${pathPrefix}/event-management`);
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
      prev.customImageUrl ? prev : { ...prev, customImageUrl: defaultQrLogo }
    );
  }, [isSuperAdmin, isEditing]);

  const nowTz = toZonedTime(new Date(), formData.timezone);
  const todayStr = format(nowTz, "yyyy-MM-dd");
  const startMinTimeStr = format(subHours(nowTz, 2), "HH:mm");

  const clampTime = (value: string, min?: string) => {
    if (!min) return value;
    return value < min ? min : value;
  };

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
      setFormData((prev) =>
        prev.expiryDate === "" && prev.expiryTime === "" ? prev : { ...prev, expiryDate: "", expiryTime: "" }
      );
      return;
    }
    const eventTz = formData.timezone;
    const revealBase = fromZonedTime(`${formData.revealDate}T00:00:00`, eventTz);
    const expiryDate = formatInTimeZone(addDays(revealBase, expiryDays), eventTz, "yyyy-MM-dd");
    setFormData((prev) =>
      prev.expiryDate === expiryDate && prev.expiryTime === "23:59"
        ? prev
        : { ...prev, expiryDate, expiryTime: "23:59" }
    );
  }, [formData.revealDate, formData.timezone, formData.maxPhotos, planType, isDemoMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("form.loading")}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background p-4 md:p-6 overflow-x-hidden"
      data-scroll-container
    >
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`${pathPrefix}/event-management`)}
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
        {isEditing && isSuperAdmin && (ownerEmail || ownerPhone) && (
          <div className="text-sm text-muted-foreground">
            {ownerEmail && (
              <p>
                <span className="font-medium">{t("events.ownerEmail")}:</span>{" "}
                {ownerEmail}
              </p>
            )}
            {ownerPhone && (
              <p>
                <span className="font-medium">{t("events.ownerPhone")}:</span>{" "}
                {ownerPhone}
              </p>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          {/* Form Column */}
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
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

            {isSuperAdmin && !isEditing && (
              <div className="space-y-2">
                <Label htmlFor="planType">{t("events.planType")}</Label>
                <select
                  id="planType"
                  value={planType}
                  onChange={(e) => {
                    const value = e.target.value as typeof planType;
                    setPlanType(value);
                    const planToMaxPhotos: Record<string, string> = {
                      demo: "10",
                      small: "200",
                      medium: "1200",
                      xxl: "",
                      custom: "",
                    };
                    if (value !== "custom") {
                      setFormData((prev) => ({
                        ...prev,
                        maxPhotos: planToMaxPhotos[value],
                      }));
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        maxPhotos: "",
                        expiryDate: "",
                        expiryTime: "",
                      }));
                    }
                  }}
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
                  disabled={!isSuperAdmin || planType !== "custom"}
                  className={!isSuperAdmin || planType !== "custom" ? "bg-muted cursor-not-allowed" : ""}
                />
              {!isSuperAdmin && (
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormData({ ...formData, backgroundImage: file });
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

            <div className="space-y-2">
              <Label className="text-base font-semibold">{t("form.uploadSection")}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="uploadStartDate">{t("form.uploadStartDate")}</Label>
                  <Input
                    id="uploadStartDate"
                    type="date"
                    value={formData.uploadStartDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      const nextStartTime = clampTime(
                        formData.uploadStartTime,
                        nextDate === todayStr ? startMinTimeStr : undefined
                      );
                      setFormData({
                        ...formData,
                        uploadStartDate: nextDate,
                        uploadStartTime: nextStartTime,
                      });
                    }}
                    min={todayStr}
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
                        uploadStartTime: clampTime(
                          e.target.value,
                          formData.uploadStartDate === todayStr ? startMinTimeStr : undefined
                        ),
                      })
                    }
                    min={formData.uploadStartDate === todayStr ? startMinTimeStr : undefined}
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
              {formData.countryCode !== "ES" && formData.uploadStartDate && formData.uploadEndDate && (
                <p className="text-xs text-muted-foreground">
                  🇪🇸 {t("events.inSpain")}: {(() => {
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
              {formData.countryCode !== "ES" && formData.revealDate && (
                <p className="text-xs text-muted-foreground">
                  🇪🇸 {t("events.inSpain")}: {(() => {
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
                    disabled={!isSuperAdmin || planType !== "custom"}
                  />
                  </div>
                </div>
                {formData.countryCode !== "ES" && formData.expiryDate && (
                  <p className="text-xs text-muted-foreground">
                    🇪🇸 {t("events.inSpain")}: {(() => {
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

            <div className="space-y-4 border-t border-border pt-4">
              <Label className="text-base font-semibold">{t("form.optionsSection")}</Label>
              
              <div className="space-y-2">
                <Label>{t("form.galleryViewLabel")}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, galleryViewMode: "normal" })}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      formData.galleryViewMode === "normal"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:bg-muted/80"
                    }`}
                  >
                    {t("form.galleryViewNormal")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, galleryViewMode: "grid" })}
                    className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                      formData.galleryViewMode === "grid"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:bg-muted/80"
                    }`}
                  >
                    {t("form.galleryViewGrid")}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("form.galleryViewHint")}
                </p>
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
                            ? "bg-primary text-primary-foreground border-primary"
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
                            ? "bg-primary text-primary-foreground border-primary"
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
              </div>
            )}
          </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  toast({
                    title: t("form.cancel"),
                    description: t("form.cancel"),
                  });
                  navigate(`${pathPrefix}/event-management`);
                }}
                className="w-full sm:w-auto"
              >
                {t("form.cancel")}
              </Button>
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteEvent}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("events.delete")}
                </Button>
              )}
              <Button type="submit" className="w-full sm:flex-1" disabled={isSubmitting || uploadingImage}>
                {uploadingImage
                  ? t("form.uploadingImage")
                  : isSubmitting 
                    ? (isEditing ? t("form.updating") : t("form.creatingText")) 
                    : (isEditing ? t("form.updateButton") : t("form.createButton"))
                }
              </Button>
            </div>

            {isEditing && (
              <div className="pt-4 text-sm text-muted-foreground" />
            )}
          </form>
          </Card>

          {/* Preview Column */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              {isEditing && eventId && (
                <Card className="p-4 mb-4">
                  <div className="flex justify-center">
                    {(() => {
                      const qrUrl = getEventQrUrl(eventId);
                      return (
                        <div
                          className="cursor-pointer"
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
                            <img
                              src={qrUrl}
                              alt="QR"
                              className="w-[160px] h-[160px]"
                            />
                          ) : (
                            <QRCodeSVG value={eventUrl} size={160} />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={handleDownloadQR}
                  >
                    {t("events.downloadQrAction")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => window.open(eventUrl, "_blank")}
                  >
                    {t("events.accessLink")}
                  </Button>
                </Card>
              )}
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

        {isEditing && eventId && (
          <div className="lg:hidden">
            <Card className="p-4">
              <div className="flex justify-center">
                {(() => {
                  const qrUrl = getEventQrUrl(eventId);
                  return (
                    <div
                      className="cursor-pointer"
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
                        <img
                          src={qrUrl}
                          alt="QR"
                          className="w-[160px] h-[160px]"
                        />
                      ) : (
                        <QRCodeSVG value={eventUrl} size={160} />
                      )}
                    </div>
                  );
                })()}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={handleDownloadQR}
              >
                {t("events.downloadQrAction")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => window.open(eventUrl, "_blank")}
              >
                {t("events.accessLink")}
              </Button>
            </Card>
          </div>
        )}
      </div>

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
    </div>
  );
};

export default EventForm;
