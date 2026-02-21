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
import { addDays, format } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import CountrySelect from "@/components/CountrySelect";
import LanguageSelect from "@/components/LanguageSelect";
import FontSelect from "@/components/FontSelect";
import FontSizeSelect, { FontSizeOption } from "@/components/FontSizeSelect";
import EventPreview from "@/components/EventPreview";
import { Language } from "@/lib/translations";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";
import { FilterType, FILTER_ORDER } from "@/lib/photoFilters";
import { useAdminI18n } from "@/lib/adminI18n";
import { QRCodeSVG } from "qrcode.react";

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
  // Generate a random 32-character hash for passwords
  const generateHash = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let hash = '';
    for (let i = 0; i < 32; i++) {
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
    };
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, pathPrefix } = useAdminI18n();

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
      });
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
            max_photos: isRestrictedAdmin ? 10 : (formData.maxPhotos ? parseInt(formData.maxPhotos) : null),
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
          } as any)
          .eq("id", eventId);

        if (error) throw error;

        toast({
          title: t("form.updateTitle"),
          description: t("form.updateDesc"),
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
          max_photos: formData.maxPhotos ? parseInt(formData.maxPhotos) : (isDemoMode ? 30 : null),
          custom_image_url: customImageUrl,
          background_image_url: backgroundImageUrl,
          filter_type: formData.filterType,
          font_family: formData.fontFamily,
          font_size: formData.fontSize,
          is_demo: isDemoMode,
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
      }

      navigate(`${pathPrefix}/event-management`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("form.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {isEditing ? t("form.title.edit") : t("form.title.new")}
          </h1>
        </div>

        <div className="grid lg:grid-cols-[1fr,280px] gap-6">
          {/* Form Column */}
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t("form.countryQuestion")}
              </Label>
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
              <p className="text-xs text-muted-foreground">
                {t("form.fontHint")}
              </p>
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="maxPhotos">
                {t("form.maxPhotos")}
              </Label>
              <Input
                id="maxPhotos"
                type="number"
                min="1"
                value={isRestrictedAdmin ? "10" : formData.maxPhotos}
                onChange={(e) =>
                  setFormData({ ...formData, maxPhotos: e.target.value })
                }
                placeholder={isDemoMode ? t("form.maxPhotosDemoDefault") : t("form.maxPhotosUnlimited")}
                disabled={isRestrictedAdmin}
                className={isRestrictedAdmin ? "bg-muted cursor-not-allowed" : ""}
              />
              {isRestrictedAdmin && (
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
                    {t(`form.filter.${filter}`)}
                  </button>
                ))}
              </div>
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

            <div className="space-y-2">
              <Label className="text-base font-semibold">{t("form.uploadSection")}</Label>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="uploadStartTime">{t("form.uploadStartTime")}</Label>
                  <Input
                    id="uploadStartTime"
                    type="time"
                    value={formData.uploadStartTime}
                    onChange={(e) =>
                      setFormData({ ...formData, uploadStartTime: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="uploadEndTime">{t("form.uploadEndTime")}</Label>
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
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="revealTime">{t("form.revealTimeLabel")}</Label>
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">{t("form.expiryDateLabel")}</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) =>
                        setFormData({ ...formData, expiryDate: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiryTime">{t("form.expiryTimeLabel")}</Label>
                    <Input
                      id="expiryTime"
                      type="time"
                      value={formData.expiryTime}
                      onChange={(e) =>
                        setFormData({ ...formData, expiryTime: e.target.value })
                      }
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
                <div className="grid grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-2 gap-2">
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
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`${pathPrefix}/event-management`)}
                className="w-full sm:w-auto"
              >
                {t("form.cancel")}
              </Button>
              <Button type="submit" className="w-full sm:flex-1" disabled={isSubmitting || uploadingImage}>
                {uploadingImage
                  ? t("form.uploadingImage")
                  : isSubmitting 
                    ? (isEditing ? t("form.updating") : t("form.creatingText")) 
                    : (isEditing ? t("form.updateButton") : t("form.createButton"))
                }
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

export default EventForm;
