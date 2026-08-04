import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, CalendarDays, List, Plus, Edit, Copy, Download, Eye, LogOut, ArrowLeft, User, Lock, Camera, Video, Mic, MoveRight, ChevronDown, MessageSquareText, KeyRound, Gamepad2, Gift, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getCountryByCode } from "@/lib/countries";
import { getLanguageByCode } from "@/lib/translations";
import { QRCodeSVG } from "qrcode.react";
import { FilterType } from "@/lib/photoFilters";
import { getEventStatus } from "@/lib/eventStatus";
import GalleryPreviewModal from "@/components/GalleryPreviewModal";
import FolderCard, { EventFolder } from "@/components/FolderCard";
import SortableEventList from "@/components/SortableEventList";
import { useAdminI18n } from "@/lib/adminI18n";
import { PricingPreview } from "@/components/PricingPreview";
import { deleteRevelaoEventsCompletely } from "@/lib/deleteRevelaoEvents";
import { AdminEventsCalendar } from "@/components/AdminEventsCalendar";

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
  font_family: string;
  font_size: string;
  created_at: string;
  is_demo: boolean;
  country_code: string;
  timezone: string;
  language: string;
  description: string | null;
  expiry_date: string | null;
  expiry_redirect_url: string | null;
  folder_id: string | null;
  sort_order: number;
  allow_photo_sharing?: boolean;
  gallery_view_mode?: string;
  owner_email?: string | null;
  owner_phone?: string | null;
  photo_count?: number | null;
  video_count?: number | null;
  audio_count?: number | null;
  allow_video_recording?: boolean;
  max_videos?: number | null;
  max_video_duration?: number | null;
  allow_audio_recording?: boolean;
  max_audios?: number | null;
  max_audio_duration?: number | null;
  limits_json?: any;
}

interface CaptainsManagedEvent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  public_url: string | null;
  qr_url: string | null;
  created_at: string;
  table_count: number;
  challenge_count: number;
  owner_email?: string | null;
  owner_phone?: string | null;
}

type AdminEventTab = "new" | "upcoming" | "past" | "tests" | "others";
type ManualAdminEventTab = Exclude<AdminEventTab, "others">;

const ADMIN_EVENT_TAB_KEY = "admin_event_tab";
const ADMIN_EVENT_NOTE_KEY = "admin_note";
const ADMIN_EVENT_TABS: Array<{ value: AdminEventTab; label: string }> = [
  { value: "new", label: "Nuevos" },
  { value: "upcoming", label: "Próximos" },
  { value: "past", label: "Pasados" },
  { value: "tests", label: "Pruebas" },
  { value: "others", label: "Otros" },
];
const ADMIN_EVENT_MOVE_TARGETS: Array<{ value: AdminEventTab; label: string }> = ADMIN_EVENT_TABS;
const INITIAL_LOAD_TIMEOUT_MS = 15_000;

type GiftPlanId = "demo" | "small" | "medium" | "xxl";

const emptyGiftForm = () => ({
  planId: "small" as GiftPlanId,
  recipientName: "",
  email: "",
  password: "",
});

const generateGiftPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint8Array(8);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
};

const withInitialLoadTimeout = <T,>(promise: PromiseLike<T>, operation: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${operation} timed out after ${INITIAL_LOAD_TIMEOUT_MS}ms`)),
      INITIAL_LOAD_TIMEOUT_MS,
    );
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
};

const parseEventLimits = (raw: any): Record<string, unknown> => {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
};

const getManualAdminEventTab = (event: Event): ManualAdminEventTab | null => {
  const value = parseEventLimits(event.limits_json)[ADMIN_EVENT_TAB_KEY];
  return value === "new" || value === "upcoming" || value === "past" || value === "tests" ? value : null;
};

const getAdminEventTabLabel = (value: AdminEventTab) =>
  ADMIN_EVENT_TABS.find((tab) => tab.value === value)?.label || value;

const getAdminEventNote = (event: Event): string => {
  const note = parseEventLimits(event.limits_json)[ADMIN_EVENT_NOTE_KEY];
  return typeof note === "string" ? note : "";
};

const getDemoContact = (event: Event): { email: string | null; phone: string | null } => {
  const contact = parseEventLimits(event.limits_json).demo_contact;
  if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
    return { email: null, phone: null };
  }
  const record = contact as Record<string, unknown>;
  return {
    email: typeof record.email === "string" && record.email.trim() ? record.email.trim() : null,
    phone: typeof record.phone === "string" && record.phone.trim() ? record.phone.trim() : null,
  };
};

const getAdminOwnerEmail = (event: Event) => event.owner_email || getDemoContact(event).email;
const getAdminOwnerPhone = (event: Event) => event.owner_phone || getDemoContact(event).phone;
const getStoredQrImageUrl = (event: Event) => {
  const qrImageUrl = parseEventLimits(event.limits_json).qr_image_url;
  return typeof qrImageUrl === "string" && qrImageUrl.trim() ? qrImageUrl.trim() : null;
};
const isNuevoEventoDemo2 = (event: Event) => parseEventLimits(event.limits_json).created_from === "nuevoeventodemo2";

interface MediaUsageTagProps {
  photoCount: number | string;
  photoLimit: number | string;
  videoCount: number | string;
  videoLimit: number | string;
  audioCount: number | string;
  audioLimit: number | string;
  onClick?: () => void;
  className?: string;
}


const MediaUsageTag = ({
  photoCount,
  photoLimit,
  videoCount,
  videoLimit,
  audioCount,
  audioLimit,
  onClick,
  className = "",
}: MediaUsageTagProps) => {
  const content = (
    <>
      <span className="inline-flex items-center gap-1">
        <Camera className="w-3.5 h-3.5" />
        {photoCount}/{photoLimit}
      </span>
      <span className="inline-flex items-center gap-1">
        <Video className="w-3.5 h-3.5" />
        {videoCount}/{videoLimit}
      </span>
      <span className="inline-flex items-center gap-1">
        <Mic className="w-3.5 h-3.5" />
        {audioCount}/{audioLimit}
      </span>
    </>
  );

  if (onClick) {
    return (
      <Button
        variant="outline"
        className={`h-auto rounded-full px-3 py-1 text-xs font-medium text-foreground gap-2 ${className}`}
        onClick={onClick}
      >
        {content}
      </Button>
    );
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground gap-2 ${className}`}
    >
      {content}
    </div>
  );
};

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [captainsEvents, setCaptainsEvents] = useState<CaptainsManagedEvent[]>([]);
  const [folders, setFolders] = useState<EventFolder[]>([]);
  const [eventPhotoCounts, setEventPhotoCounts] = useState<Record<string, number>>({});
  const [eventMediaCounts, setEventMediaCounts] = useState<
    Record<string, { photos: number; videos: number; audios: number }>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [adminEventId] = useState(() => localStorage.getItem("adminEventId"));
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [marketingSaving, setMarketingSaving] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
  const [noteEvent, setNoteEvent] = useState<Event | null>(null);
  const [adminNoteDraft, setAdminNoteDraft] = useState("");
  const [adminNoteSaving, setAdminNoteSaving] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingStep, setPricingStep] = useState<"plans" | "redeem">("plans");
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [pendingRedeem, setPendingRedeem] = useState<{
    token: string;
    planLabel: string;
  } | null>(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminTypeFilter, setAdminTypeFilter] = useState<"all" | "Demo" | "Start" | "Plus" | "Pro" | "Capitanes">("all");
  const [adminPhoneFilter, setAdminPhoneFilter] = useState<"all" | "yes" | "no">("all");
  const [adminActiveTab, setAdminActiveTab] = useState<AdminEventTab>("upcoming");
  const [adminSort, setAdminSort] = useState<{ key: "name" | "type" | "start" | "creation" | "email" | "photos"; direction: "asc" | "desc" }>({
    key: "start",
    direction: "desc",
  });
  const [qrPreview, setQrPreview] = useState<{ src?: string; value: string } | null>(null);
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState<number | "all">(30);
  const [adminView, setAdminView] = useState<"list" | "calendar">("list");
  // pageSize computed after superAdminEvents below
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [redeemGeneratorOpen, setRedeemGeneratorOpen] = useState(false);
  const [redeemPlan, setRedeemPlan] = useState<"demo" | "small" | "medium" | "xxl">("small");
  const [generatedRedeem, setGeneratedRedeem] = useState<string | null>(null);
  const [isGeneratingRedeem, setIsGeneratingRedeem] = useState(false);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftExistingConfirmationOpen, setGiftExistingConfirmationOpen] = useState(false);
  const [giftForm, setGiftForm] = useState(emptyGiftForm);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [createdSummary, setCreatedSummary] = useState<{
    id: string;
    name: string;
    password_hash: string;
    upload_start_time: string | null;
    upload_end_time: string | null;
    reveal_time: string;
    max_photos: number | null;
    max_videos?: number | null;
    max_audios?: number | null;
    owner_email: string | null;
  } | null>(null);
  
  // Dialogs

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t, dateLocale, pathPrefix } = useAdminI18n();

  const loadMediaCounts = async (eventsList: Event[]) => {
    const eventIds = eventsList.map((event) => event.id).filter(Boolean);
    if (eventIds.length === 0) {
      setEventMediaCounts({});
      setEventPhotoCounts({});
      return;
    }

    const fallbackCounts: Record<string, { photos: number; videos: number; audios: number }> = {};
    for (const event of eventsList) {
      fallbackCounts[event.id] = {
        photos: event.photo_count ?? 0,
        videos: event.video_count ?? 0,
        audios: event.audio_count ?? 0,
      };
    }
    const baseCounts: Record<string, { photos: number; videos: number; audios: number }> = {};
    for (const eventId of eventIds) {
      baseCounts[eventId] = fallbackCounts[eventId] ?? { photos: 0, videos: 0, audios: 0 };
    }

    const countMediaForEvent = async (eventId: string) => {
      const [photosRes, videosRes, audiosRes] = await Promise.all([
        supabase.from("photos").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("videos").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("audios").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      ]);

      return {
        eventId,
        counts: {
          photos: photosRes.error ? fallbackCounts[eventId]?.photos ?? 0 : photosRes.count ?? 0,
          videos: videosRes.error ? fallbackCounts[eventId]?.videos ?? 0 : videosRes.count ?? 0,
          audios: audiosRes.error ? fallbackCounts[eventId]?.audios ?? 0 : audiosRes.count ?? 0,
        },
      };
    };

    const batchSize = 12;
    for (let index = 0; index < eventIds.length; index += batchSize) {
      const batch = eventIds.slice(index, index + batchSize);
      const results = await Promise.all(batch.map((eventId) => countMediaForEvent(eventId)));
      for (const result of results) {
        baseCounts[result.eventId] = result.counts;
      }
    }

    const photoCounts: Record<string, number> = {};
    for (const [eventId, counts] of Object.entries(baseCounts)) {
      photoCounts[eventId] = counts.photos;
    }

    setEventMediaCounts(baseCounts);
    setEventPhotoCounts(photoCounts);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // If accessed via admin password, allow access without full auth
        if (adminEventId) {
          await loadData();
          return;
        }
        const { data: { session } } = await withInitialLoadTimeout(
          supabase.auth.getSession(),
          "Restoring the session",
        );
        if (!session) {
          navigate(`${pathPrefix}/admin-login`);
          return;
        }
        const { data: { user }, error: userError } = await supabase.auth.getUser(session.access_token);
        if (userError || !user) {
          await supabase.auth.signOut({ scope: "local" });
          navigate(`${pathPrefix}/admin-login`);
          return;
        }
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? null);
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("marketing_opt_in")
          .eq("id", user.id)
          .maybeSingle();
        setMarketingOptIn(profile?.marketing_opt_in ?? true);
        await loadData();
      } catch (error) {
        console.error("Error checking authentication:", error);
        setLoadError(true);
        setIsLoading(false);
      }
    };

    checkAuth();

    if (!isDemoMode && !adminEventId) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!session) {
          navigate(`${pathPrefix}/admin-login`);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [navigate, isDemoMode, adminEventId]);

  const handleMarketingToggle = async (checked: boolean) => {
    if (!currentUserId) return;
    try {
      setMarketingSaving(true);
      const { error } = await supabase
        .from("user_profiles")
        .upsert(
          {
            id: currentUserId,
            marketing_opt_in: checked,
          },
          { onConflict: "id" },
        );
      if (error) throw error;
      setMarketingOptIn(checked);
      toast({
        title: "Preferencias guardadas",
        description: "Se actualizó tu preferencia de comunicaciones comerciales.",
      });
    } catch (error) {
      console.error("Error updating marketing preference:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la preferencia.",
        variant: "destructive",
      });
    } finally {
      setMarketingSaving(false);
    }
  };


  useEffect(() => {
    const created = (location.state as any)?.createdEvent;
    if (created) {
      setCreatedSummary(created);
      setAdminActiveTab("new");
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const loadData = async () => {
    try {
      setLoadError(false);
      // If we have an adminEventId, only load that specific event
      if (adminEventId) {
        const { data: eventData, error: eventError } = await withInitialLoadTimeout(
          supabase.from("events").select("*").eq("id", adminEventId).single(),
          "Loading the event",
        );

        if (eventError) throw eventError;

        setFolders([]);
        setEvents(eventData ? [eventData as Event] : []);
        setCaptainsEvents([]);

        if (eventData) {
          await loadMediaCounts([eventData as Event]);
        } else {
          setEventMediaCounts({});
          setEventPhotoCounts({});
        }
    } else {
        const { data: { session } } = await withInitialLoadTimeout(
          supabase.auth.getSession(),
          "Restoring the session",
        );
        if (!session) {
          navigate(`${pathPrefix}/admin-login`);
          return;
        }

        const isAdminUser = (session.user?.email || "").toLowerCase() === "revelao.cam@gmail.com";
        setIsSuperAdmin(isAdminUser);

        const { data: eventsPayload, error: eventsError } = await withInitialLoadTimeout(
          supabase.functions.invoke(
            isAdminUser ? "admin-events" : "my-events",
            {
              method: "GET",
              headers: { Authorization: `Bearer ${session.access_token}` },
            },
          ),
          "Loading events",
        );
        if (eventsError) throw eventsError;

        const fetchedEvents = (eventsPayload?.events || []) as Event[];
        const fetchedCaptainsEvents = (eventsPayload?.captainsEvents || []) as CaptainsManagedEvent[];
        setEvents(fetchedEvents);
        setCaptainsEvents(fetchedCaptainsEvents);

        // The event list is usable at this point. Optional metadata must not
        // leave the whole page behind an indefinite loading screen.
        setIsLoading(false);

        if (isAdminUser) {
          setFolders([]);
          setPendingRedeem(null);
        } else {
          const { data: pendingPayload } = await supabase.functions.invoke(
            "redeem-pending",
            {
              method: "GET",
              headers: { Authorization: `Bearer ${session.access_token}` },
            },
          );
          const pending = pendingPayload?.pending;
          if (pending?.token) {
            setPendingRedeem({
              token: pending.token,
              planLabel: pending.plan?.label ?? "evento",
            });
          } else {
            setPendingRedeem(null);
          }
        }

        const folderIds = Array.from(new Set(fetchedEvents.map((e) => e.folder_id).filter(Boolean))) as string[];
        if (folderIds.length > 0) {
          const { data: folderData, error: folderError } = await supabase
            .from("event_folders")
            .select("*")
            .in("id", folderIds)
            .order("created_at", { ascending: true });
          if (folderError) throw folderError;
          setFolders((folderData || []) as EventFolder[]);
        } else {
          setFolders([]);
        }

        await loadMediaCounts(fetchedEvents);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setLoadError(true);
      toast({
        title: t("form.errorTitle"),
        description: t("events.loadError"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      localStorage.removeItem("isDemoMode");
      localStorage.removeItem("adminEventId");
      navigate(`${pathPrefix}/admin-login`, { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
      if (error) throw error;
      await supabase.auth.signOut();
      localStorage.removeItem("isDemoMode");
      localStorage.removeItem("adminEventId");
      navigate(`${pathPrefix}/admin-login`, { replace: true });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: t("form.errorTitle"),
        description: "No se pudo eliminar la cuenta.",
        variant: "destructive",
      });
    }
  };

  const handleRedeemSubmit = () => {
    const code = redeemCode.trim();
    if (code.length !== 16 && code.length !== 36) {
      setRedeemError(t("events.redeemInvalidLength"));
      return;
    }
    setRedeemError(null);
    navigate(`${pathPrefix}/redeem/${code}`);
  };

  const handleGenerateRedeem = async () => {
    try {
      setIsGeneratingRedeem(true);
      setGeneratedRedeem(null);
      const { data, error } = await supabase.functions.invoke("admin-generate-redeem", {
        body: { planId: redeemPlan },
      });
      if (error || !data?.token) {
        throw error || new Error("NO_TOKEN");
      }
      setGeneratedRedeem(data.token);
      toast({
        title: "Código generado",
        description: "El código ya está listo para usar.",
      });
    } catch (error) {
      console.error("Error generating redeem:", error);
      toast({
        title: t("form.errorTitle"),
        description: "No se pudo generar el código.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingRedeem(false);
    }
  };

  const handleCopyRedeem = async () => {
    if (!generatedRedeem) return;
    const redeemUrl = `${window.location.origin}${pathPrefix}/redeem/${generatedRedeem}`;
    try {
      await navigator.clipboard.writeText(redeemUrl);
      toast({
        title: "Enlace copiado",
        description: "Ya puedes compartir el enlace de canje.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace.",
        variant: "destructive",
      });
    }
  };

  const handleGiftDialogChange = (open: boolean) => {
    if (!open && isSendingGift) return;
    setGiftDialogOpen(open);
    if (!open && !isSendingGift) {
      setGiftExistingConfirmationOpen(false);
      setGiftError(null);
      setGiftForm(emptyGiftForm());
    }
  };

  const handleSendGift = async (confirmExisting = false) => {
    const recipientName = giftForm.recipientName.trim();
    const email = giftForm.email.trim().toLowerCase();
    if (!recipientName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || giftForm.password.length < 8) {
      setGiftError("Completa el nombre, un email válido y una contraseña de al menos 8 caracteres.");
      toast({
        title: "Revisa los datos",
        description: "Completa el nombre, un email válido y una contraseña de al menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingGift(true);
    setGiftError(null);
    try {
      const { data, error } = await withInitialLoadTimeout(
        supabase.functions.invoke("admin-gift-revelao", {
          body: {
            planId: giftForm.planId,
            recipientName,
            email,
            password: giftForm.password,
            confirmExisting,
          },
        }),
        "Sending Revelao gift",
      );
      if (error || data?.error) throw error || new Error(data.error);
      if (data?.requiresConfirmation) {
        setGiftExistingConfirmationOpen(true);
        return;
      }
      if (!data?.ok) throw new Error("GIFT_FAILED");

      setGiftExistingConfirmationOpen(false);
      setGiftDialogOpen(false);
      setGiftForm(emptyGiftForm());
      toast({
        title: "Regalo enviado",
        description: data.existingAccount
          ? "El enlace se ha enviado. El usuario accederá con su contraseña anterior."
          : "El enlace y las nuevas credenciales se han enviado al destinatario.",
      });
    } catch (error) {
      console.error("Error sending Revelao gift:", error);
      const message = error instanceof Error && error.message.includes("timed out")
        ? "El servidor está tardando demasiado. Comprueba el despliegue de la función e inténtalo de nuevo."
        : "No se ha podido crear ni enviar el regalo. Comprueba la configuración de email de Supabase e inténtalo de nuevo.";
      setGiftError(message);
      toast({
        title: "No se pudo enviar el regalo",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSendingGift(false);
    }
  };

  // Get events organized by folder, sorted by sort_order
  const eventsByFolder = useMemo(() => {
    const result: Record<string, Event[]> = { unfiled: [] };
    folders.forEach((f) => (result[f.id] = []));
    
    events.forEach((event) => {
      if (event.folder_id && result[event.folder_id]) {
        result[event.folder_id].push(event);
      } else {
        result.unfiled.push(event);
      }
    });

    // Sort each folder's events by sort_order
    Object.keys(result).forEach((key) => {
      result[key].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
    
    return result;
  }, [events, folders]);

  const shouldShowPricing = useMemo(() => {
    if (!adminEventId || events.length !== 1) return false;
    const adminPass = events[0]?.admin_password || "";
    return /^.{8}$/.test(adminPass);
  }, [adminEventId, events]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const getPlanType = (maxPhotos?: number | null) => {
    if (maxPhotos === 10) return { label: "Demo", color: "bg-[#f06a5f]/10 text-[#f06a5f] border-[#f06a5f]/30" };
    if (maxPhotos === 50 || maxPhotos === 200) return { label: "Start", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (maxPhotos === 300 || maxPhotos === 1200) return { label: "Plus", color: "bg-blue-50 text-blue-700 border-blue-200" };
    if (maxPhotos === 500 || maxPhotos === 1000 || maxPhotos == null) return { label: "Pro", color: "bg-purple-50 text-purple-700 border-purple-200" };
    return { label: "-", color: "bg-muted text-muted-foreground border-border" };
  };

  const truncate = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max)}...` : value;
  const truncateEmail = (value: string, max: number) =>
    value.length > max ? `${value.slice(0, max)}...` : value;
  const getMediaCounts = (event: Event) => {
    const liveCounts = eventMediaCounts[event.id];
    const photos = liveCounts?.photos ?? eventPhotoCounts[event.id] ?? event.photo_count ?? 0;
    const videos = liveCounts?.videos ?? event.video_count ?? 0;
    const audios = liveCounts?.audios ?? event.audio_count ?? 0;
    return { photos, videos, audios };
  };

  const getMediaLimits = (event: Event) => {
    const photos = event.max_photos ?? "∞";
    const videos = event.allow_video_recording === false
      ? "0"
      : event.max_videos && event.max_videos > 0
      ? String(event.max_videos)
      : "∞";
    const audios = event.allow_audio_recording === false
      ? "0"
      : event.max_audios && event.max_audios > 0
      ? String(event.max_audios)
      : "∞";
    return { photos, videos, audios };
  };

  const handleAdminSort = (key: "name" | "type" | "start" | "creation" | "email" | "photos") => {
    setAdminSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const adminTabCounts = useMemo(() => {
    const counts: Record<AdminEventTab, number> = {
      new: 0,
      upcoming: 0,
      past: 0,
      tests: 0,
      others: 0,
    };

    events.forEach((event) => {
      const manualTab = getManualAdminEventTab(event);
      if (manualTab) {
        counts[manualTab] += 1;
      } else {
        counts.others += 1;
      }
    });
    counts.others += captainsEvents.length;

    return counts;
  }, [events, captainsEvents]);

  useEffect(() => {
    if (!isLoading && adminActiveTab === "new" && adminTabCounts.new === 0) {
      setAdminActiveTab("upcoming");
    }
  }, [adminActiveTab, adminTabCounts.new, isLoading]);

  const superAdminEvents = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();
    let list = events.filter((event) => {
      const matchesSearch =
        !search ||
        event.name.toLowerCase().includes(search) ||
        (getAdminOwnerEmail(event) || "").toLowerCase().includes(search);
      const planLabel = getPlanType(event.max_photos).label;
      const matchesType = adminTypeFilter === "all" || planLabel === adminTypeFilter;
      const hasPhone = !!getAdminOwnerPhone(event);
      const matchesPhone =
        adminPhoneFilter === "all" ||
        (adminPhoneFilter === "yes" && hasPhone) ||
        (adminPhoneFilter === "no" && !hasPhone);
      const manualTab = getManualAdminEventTab(event);
      const matchesTab = adminActiveTab === "others" ? !manualTab : manualTab === adminActiveTab;
      return matchesSearch && matchesType && matchesPhone && matchesTab;
    });

    list = [...list].sort((a, b) => {
      const direction = adminSort.direction === "asc" ? 1 : -1;
      const getValue = (event: Event) => {
        switch (adminSort.key) {
          case "name":
            return event.name.toLowerCase();
          case "type":
            return getPlanType(event.max_photos).label;
          case "email":
            return (getAdminOwnerEmail(event) || "").toLowerCase();
          case "photos":
            return eventMediaCounts[event.id]?.photos ?? eventPhotoCounts[event.id] ?? 0;
          case "creation":
            return event.created_at || "";
          case "start":
          default:
            return event.upload_start_time || "";
        }
      };
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * direction;
      }
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
    return list;
  }, [events, adminSearch, adminTypeFilter, adminPhoneFilter, adminActiveTab, adminSort, eventPhotoCounts, eventMediaCounts]);

  const pageSize = adminPageSize === "all" ? superAdminEvents.length || 1 : adminPageSize;

  useEffect(() => {
    setAdminPage(1);
  }, [adminSearch, adminTypeFilter, adminPhoneFilter, adminActiveTab, adminSort, adminPageSize]);

  useEffect(() => {
    if (selectedEventIds.size === 0) return;
    const currentIds = new Set(superAdminEvents.map((event) => event.id));
    const next = new Set(Array.from(selectedEventIds).filter((id) => currentIds.has(id)));
    if (next.size !== selectedEventIds.size) {
      setSelectedEventIds(next);
    }
  }, [superAdminEvents, selectedEventIds]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const paginatedAdminEvents = useMemo(() => {
    const start = (adminPage - 1) * pageSize;
    return superAdminEvents.slice(start, start + pageSize);
  }, [superAdminEvents, adminPage, pageSize]);

  const totalAdminPages = Math.max(1, Math.ceil(superAdminEvents.length / pageSize));

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const getDeletionLockPin = (event: Event): string | null => {
    const directPin = (event as any).deletion_lock_pin;
    if (typeof directPin === "string" && directPin.trim().length > 0) {
      return directPin.trim();
    }

    const parsed = parseEventLimits(event.limits_json);
    const pin = parsed.deletion_lock_pin;
    return typeof pin === "string" && pin.trim().length > 0 ? pin.trim() : null;
  };

  const isEventDeletionLocked = (event: Event) => !!getDeletionLockPin(event);

  const handleDeleteSelection = async () => {
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;
    const selectedEvents = superAdminEvents.filter((event) => ids.includes(event.id));
    const lockedEvents = selectedEvents.filter((event) => isEventDeletionLocked(event));

    for (const event of lockedEvents) {
      const expectedPin = getDeletionLockPin(event);
      if (!expectedPin) continue;
      const enteredPin = window.prompt(`El evento "${event.name}" está bloqueado. Introduce PIN para eliminarlo:`);
      if (!enteredPin || enteredPin.trim() !== expectedPin) {
        toast({
          title: "PIN incorrecto",
          description: "No se pudo eliminar porque el PIN de bloqueo no coincide.",
          variant: "destructive",
        });
        return;
      }
    }

    const confirmed = window.confirm(`¿Eliminar ${ids.length} evento(s) seleccionados?`);
    if (!confirmed) return;

    try {
      await deleteRevelaoEventsCompletely(ids, {
        adminPassword: selectedEvents.length === 1 ? selectedEvents[0].admin_password : null,
      });
      setSelectedEventIds(new Set());
      await loadData();
      toast({
        title: t("events.deleteTitle"),
        description: t("events.deleteDesc"),
      });
    } catch (error) {
      console.error("Error deleting selection:", error);
      toast({
        title: t("events.deleteError"),
        description: t("events.deleteError"),
        variant: "destructive",
      });
    }
  };

  const handleLockSelection = async () => {
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;
    const pin = window.prompt("Introduce un PIN para bloquear los eventos seleccionados:");
    if (!pin || !pin.trim()) return;
    const normalizedPin = pin.trim();

    try {
      const { error } = await supabase.functions.invoke("admin-lock-events", {
        method: "POST",
        body: {
          eventIds: ids,
          pin: normalizedPin,
        },
      });
      if (error) throw error;

      setEvents((prev) =>
        prev.map((event) => {
          if (!ids.includes(event.id)) return event;
          const currentLimits =
            event.limits_json && typeof event.limits_json === "object" && !Array.isArray(event.limits_json)
              ? (event.limits_json as Record<string, unknown>)
              : {};
          return {
            ...event,
            limits_json: {
              ...currentLimits,
              deletion_lock_pin: normalizedPin,
            },
          };
        }),
      );
      await loadData();
      toast({
        title: "Eventos bloqueados",
        description: `Se aplicó el PIN a ${ids.length} evento(s).`,
      });
    } catch (error) {
      console.error("Error locking selected events:", error);
      toast({
        title: "No se pudo bloquear",
        description: "Hubo un problema al guardar el PIN de bloqueo.",
        variant: "destructive",
      });
    }
  };

  const handleMoveSelection = async (targetTab: AdminEventTab) => {
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;
    const selectedEvents = events.filter((event) => ids.includes(event.id));

    try {
      await Promise.all(
        selectedEvents.map((event) => {
          const nextLimits = parseEventLimits(event.limits_json);
          if (targetTab === "others") {
            delete nextLimits[ADMIN_EVENT_TAB_KEY];
          } else {
            nextLimits[ADMIN_EVENT_TAB_KEY] = targetTab;
          }

          return supabase
            .from("events")
            .update({ limits_json: nextLimits as never })
            .eq("id", event.id)
            .then(({ error }) => {
              if (error) throw error;
            });
        }),
      );

      setEvents((prev) =>
        prev.map((event) => {
          if (!ids.includes(event.id)) return event;
          const nextLimits = parseEventLimits(event.limits_json);
          if (targetTab === "others") {
            delete nextLimits[ADMIN_EVENT_TAB_KEY];
          } else {
            nextLimits[ADMIN_EVENT_TAB_KEY] = targetTab;
          }
          return { ...event, limits_json: nextLimits };
        }),
      );
      setSelectedEventIds(new Set());
      toast({
        title: "Eventos movidos",
        description:
          targetTab === "others"
            ? `${ids.length} evento(s) movidos a Otros.`
            : `${ids.length} evento(s) movidos a ${getAdminEventTabLabel(targetTab)}.`,
      });
    } catch (error) {
      console.error("Error moving selected events:", error);
      toast({
        title: "No se pudieron mover",
        description: "Hubo un problema al guardar la organización de los eventos.",
        variant: "destructive",
      });
    }
  };

  const openAdminNote = (event: Event) => {
    setNoteEvent(event);
    setAdminNoteDraft(getAdminEventNote(event));
  };

  const handleSaveAdminNote = async () => {
    if (!noteEvent) return;
    const normalizedNote = adminNoteDraft.trim();
    const nextLimits = parseEventLimits(noteEvent.limits_json);
    if (normalizedNote) {
      nextLimits[ADMIN_EVENT_NOTE_KEY] = normalizedNote;
    } else {
      delete nextLimits[ADMIN_EVENT_NOTE_KEY];
    }

    try {
      setAdminNoteSaving(true);
      const { error } = await supabase
        .from("events")
        .update({ limits_json: nextLimits as never })
        .eq("id", noteEvent.id);
      if (error) throw error;

      setEvents((prev) =>
        prev.map((event) =>
          event.id === noteEvent.id ? { ...event, limits_json: nextLimits } : event,
        ),
      );
      setNoteEvent(null);
      setAdminNoteDraft("");
      toast({
        title: "Nota guardada",
        description: "La nota interna del evento se ha actualizado.",
      });
    } catch (error) {
      console.error("Error saving admin note:", error);
      toast({
        title: "No se pudo guardar",
        description: "Hubo un problema al guardar la nota del evento.",
        variant: "destructive",
      });
    } finally {
      setAdminNoteSaving(false);
    }
  };

  const handleCopyValue = async (eventUrl: string) => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast({
        title: t("events.copyUrl"),
        description: t("events.copyUrlDesc"),
      });
    } catch (error) {
      console.error("Error copying URL:", error);
    }
  };

  const handleCopyUrl = (password: string) =>
    handleCopyValue(`https://acceso.revelao.cam/events/${password}`);

  const getEventQrUrl = (event: Event) => {
    const storedQrUrl = getStoredQrImageUrl(event) || localStorage.getItem(`event-qr-url-${event.id}`);
    if (storedQrUrl) return storedQrUrl;
    if (!isNuevoEventoDemo2(event)) return null;
    return supabase.storage.from("event-photos").getPublicUrl(`event-qr/qr-${event.id}.png`).data.publicUrl;
  };

  const downloadQrFromValue = async (eventUrl: string, eventName: string) => {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.background = "white";
    container.style.padding = "24px";
    document.body.appendChild(container);

    const { createRoot } = await import("react-dom/client");
    const root = createRoot(container);
    root.render(<QRCodeSVG value={eventUrl} size={512} level="H" includeMargin />);

    await new Promise((resolve) => window.setTimeout(resolve, 100));
    const svg = container.querySelector("svg");
    if (!svg) throw new Error("QR_SVG_NOT_FOUND");
    const svgText = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("CANVAS_CONTEXT_NOT_FOUND");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(svgUrl);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("PNG_EXPORT_FAILED"))), "image/png");
    });
    const dataUrl = URL.createObjectURL(blob);
    root.unmount();
    document.body.removeChild(container);

    const link = document.createElement("a");
    link.download = `qr-${eventName.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = dataUrl;
    link.click();
    URL.revokeObjectURL(dataUrl);
  };

  const handleDownloadQR = async (eventUrl: string, eventName: string, event: Event) => {
    try {
      const qrUrl = getEventQrUrl(event);
      if (!qrUrl) {
        await downloadQrFromValue(eventUrl, eventName);
        toast({
          title: t("events.downloadQrSuccessTitle"),
          description: t("events.downloadQrSuccessDesc"),
        });
        return;
      }
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error("QR_NOT_FOUND");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.download = `qr-${eventName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      toast({
        title: t("events.downloadQrSuccessTitle"),
        description: t("events.downloadQrSuccessDesc"),
      });
    } catch (error) {
      console.error("Error downloading QR:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.downloadQrError"),
        variant: "destructive",
      });
    }
  };


  // Apply folder overrides to event for preview
  const getEffectiveEvent = (event: Event): Event => {
    if (!event.folder_id) return event;
    
    const folder = folders.find((f) => f.id === event.folder_id);
    if (!folder) return event;

    return {
      ...event,
      custom_image_url: folder.custom_image_url || event.custom_image_url,
      background_image_url: folder.background_image_url || event.background_image_url,
      font_family: folder.font_family || event.font_family,
      font_size: folder.font_size || event.font_size,
    };
  };

  const renderEventCard = (event: Event) => {
    const effectiveEvent = getEffectiveEvent(event);
    const { photos: photoCount, videos: videoCount, audios: audioCount } = getMediaCounts(event);
    const { photos: photoLimit, videos: videoLimit, audios: audioLimit } = getMediaLimits(event);
    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const slideshowUrl = `${window.location.origin}/slideshow/${event.id}`;
    const statusInfo = getEventStatus(
      event.upload_start_time,
      event.upload_end_time,
      event.reveal_time,
      event.expiry_date
    );
    const qrStorageUrl = getEventQrUrl(event);
    const statusLabel = t(`events.status.${statusInfo.status}`);

    const planType = getPlanType(event.max_photos);

    return (
      <Card key={event.id} className="p-4 md:p-6">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate(`${pathPrefix}/event-form/${event.id}`)}
            className="w-full text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg md:text-xl font-semibold text-foreground">
                {event.name}
              </h3>
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${planType.color}`}>
                {planType.label}
              </span>
            </div>
          </button>
          <div className={`w-full text-center text-sm font-medium px-3 py-2 rounded-md ${statusInfo.bgColor} ${statusInfo.color}`}>
            {statusLabel}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-4 md:gap-6 items-start">
            {/* QR Code Section */}
            <div className="space-y-3 flex flex-col items-center lg:items-start">
              <div
                className="bg-white p-3 rounded-xl border border-border w-fit cursor-pointer"
                onClick={() => setQrPreview({ src: qrStorageUrl || undefined, value: eventUrl })}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setQrPreview({ src: qrStorageUrl || undefined, value: eventUrl });
                  }
                }}
              >
                {qrStorageUrl ? (
                  <img
                    src={qrStorageUrl}
                    alt={t("events.qrAlt")}
                    className="w-[120px] h-[120px]"
                  />
                ) : (
                  <QRCodeSVG value={eventUrl} size={120} />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleDownloadQR(eventUrl, event.name, event)
                }
                className="w-full gap-2"
              >
                <Download className="w-4 h-4" />
                {t("events.downloadQrAction")}
              </Button>
              <MediaUsageTag
                photoCount={photoCount}
                photoLimit={photoLimit}
                videoCount={videoCount}
                videoLimit={videoLimit}
                audioCount={audioCount}
                audioLimit={audioLimit}
                onClick={() => setPreviewEvent(effectiveEvent)}
                className="w-full"
              />
              <div className="space-y-2 pt-1 w-full sm:hidden">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={eventUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopyUrl(event.password_hash)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(eventUrl, "_blank", "noopener,noreferrer")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
                <p className="pt-2 text-xs font-medium text-foreground">{t("events.slideshowLabel")}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={slideshowUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopyValue(slideshowUrl)}
                    aria-label={`${t("events.copyUrl")}: ${t("events.slideshowLabel")}`}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(slideshowUrl, "_blank", "noopener,noreferrer")}
                    aria-label={t("events.slideshowLabel")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Event Info */}
            <div className="flex-1 space-y-4 w-full text-sm text-muted-foreground">
              <p>
                <span className="font-medium">{t("events.createdLabel")}:</span>{" "}
                {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}
              </p>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t("events.durationLabel")}:</p>
                {event.upload_start_time && (
                  <p>
                    <span className="font-medium">{t("events.startLabel")}:</span>{" "}
                    {formatInTimeZone(new Date(event.upload_start_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                  </p>
                )}
                {event.upload_end_time && (
                  <p>
                    <span className="font-medium">{t("events.endLabel")}:</span>{" "}
                    {formatInTimeZone(new Date(event.upload_end_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                  </p>
                )}
                {event.reveal_time && (
                  <p>
                    <span className="font-medium">{t("events.revealDate")}:</span>{" "}
                    {formatInTimeZone(new Date(event.reveal_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                  </p>
                )}
              </div>
              <div className="space-y-2 pt-1 hidden sm:block">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={eventUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopyUrl(event.password_hash)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(eventUrl, "_blank", "noopener,noreferrer")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
                <p className="pt-2 text-xs font-medium text-foreground">{t("events.slideshowLabel")}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={slideshowUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopyValue(slideshowUrl)}
                    aria-label={`${t("events.copyUrl")}: ${t("events.slideshowLabel")}`}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(slideshowUrl, "_blank", "noopener,noreferrer")}
                    aria-label={t("events.slideshowLabel")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">{t("events.country")}:</span>{" "}
                {(() => {
                  const country = getCountryByCode(event.country_code || "ES");
                  return country ? `${country.flag} ${country.name}` : "-";
                })()}
                {" / "}
                <span className="font-medium">{t("events.language")}:</span>{" "}
                {(() => {
                  const lang = getLanguageByCode(event.language || "es");
                  return lang ? `${lang.flag} ${lang.name}` : event.language || "es";
                })()}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 w-full sm:w-auto"
                onClick={() => navigate(`${pathPrefix}/event-form/${event.id}`)}
              >
                <Edit className="w-4 h-4" />
                <span>{t("events.edit")}</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderCaptainsEventCard = (event: CaptainsManagedEvent) => {
    const hasFinished = Boolean(event.end_time && new Date(event.end_time).getTime() <= Date.now());
    const publicUrl = event.public_url || `${window.location.origin}/capitanes/${event.slug}`;
    const detailUrl = `/admin/capitanes/${event.id}`;
    const openDetail = () => navigate(detailUrl, { state: { fromEventManagement: true } });

    return (
      <Card key={`captains-${event.id}`} className="p-4 md:p-6">
        <div className="space-y-4">
          <button type="button" onClick={openDetail} className="w-full text-left">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg md:text-xl font-semibold text-foreground">{event.name}</h3>
              <span className="rounded-full border border-[#f06a5f]/30 bg-[#f06a5f]/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[#f06a5f]">
                Capitanes
              </span>
            </div>
          </button>

          <div className={`w-full rounded-md px-3 py-2 text-center text-sm font-medium ${hasFinished ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-700"}`}>
            {hasFinished ? "Finalizado" : "En curso"}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-4 md:gap-6 items-start">
            <div className="space-y-3 flex flex-col items-center lg:items-start">
              <div
                className="bg-white p-3 rounded-xl border border-border w-fit cursor-pointer"
                onClick={() => setQrPreview({ src: event.qr_url || undefined, value: publicUrl })}
                role="button"
                tabIndex={0}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                    setQrPreview({ src: event.qr_url || undefined, value: publicUrl });
                  }
                }}
              >
                {event.qr_url ? (
                  <img src={event.qr_url} alt={`QR de ${event.name}`} className="w-[120px] h-[120px]" />
                ) : (
                  <QRCodeSVG value={publicUrl} size={120} />
                )}
              </div>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => downloadQrFromValue(publicUrl, event.name)}>
                <Download className="w-4 h-4" />
                {t("events.downloadQrAction")}
              </Button>
              <div className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
                <Gamepad2 className="h-3.5 w-3.5" />
                {event.table_count} mesas · {event.challenge_count} retos
              </div>
              <div className="space-y-2 pt-1 w-full sm:hidden">
                <div className="flex items-center gap-2">
                  <input type="text" value={publicUrl} readOnly className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0" />
                  <Button size="icon" variant="outline" onClick={() => handleCopyValue(publicUrl)}><Copy className="w-4 h-4" /></Button>
                  <Button size="icon" variant="outline" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}><Eye className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 w-full text-sm text-muted-foreground">
              <p><span className="font-medium">{t("events.createdLabel")}:</span> {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}</p>
              <div className="space-y-1">
                <p className="font-medium text-foreground">{t("events.durationLabel")}:</p>
                {event.start_time ? <p><span className="font-medium">{t("events.startLabel")}:</span> {format(new Date(event.start_time), "dd/MM/yyyy HH:mm", { locale: dateLocale })}</p> : null}
                {event.end_time ? <p><span className="font-medium">{t("events.endLabel")}:</span> {format(new Date(event.end_time), "dd/MM/yyyy HH:mm", { locale: dateLocale })}</p> : null}
              </div>
              <div className="space-y-2 pt-1 hidden sm:block">
                <div className="flex items-center gap-2">
                  <input type="text" value={publicUrl} readOnly className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border min-w-0" />
                  <Button size="icon" variant="outline" onClick={() => handleCopyValue(publicUrl)}><Copy className="w-4 h-4" /></Button>
                  <Button size="icon" variant="outline" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}><Eye className="w-4 h-4" /></Button>
                </div>
              </div>
              {event.description ? <p className="whitespace-pre-line">{event.description}</p> : null}
              <Button variant="outline" size="sm" className="gap-1 w-full sm:w-auto" onClick={openDetail}>
                <Edit className="w-4 h-4" />
                <span>{t("events.edit")}</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const renderEventTable = (tableEvents: Event[]) => (
    <div className="w-full">
      <table className="w-full border-separate border-spacing-y-3">
        <tbody>
          {tableEvents.map((event) => (
            <tr key={event.id}>
              <td className="p-0">{renderEventCard(event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const mixedUnfiledEvents = [
    ...eventsByFolder.unfiled.map((event) => ({ kind: "revelao" as const, event, createdAt: event.created_at })),
    ...captainsEvents.map((event) => ({ kind: "captains" as const, event, createdAt: event.created_at })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredCalendarEvents = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();
    const revelaoEntries = events
      .filter((event) => {
        const manualTab = getManualAdminEventTab(event);
        const matchesTab = adminActiveTab === "others" ? !manualTab : manualTab === adminActiveTab;
        const matchesSearch = !search
          || event.name.toLowerCase().includes(search)
          || (getAdminOwnerEmail(event) || "").toLowerCase().includes(search);
        const matchesType = adminTypeFilter === "all" || getPlanType(event.max_photos).label === adminTypeFilter;
        const hasPhone = Boolean(getAdminOwnerPhone(event));
        const matchesPhone = adminPhoneFilter === "all"
          || (adminPhoneFilter === "yes" && hasPhone)
          || (adminPhoneFilter === "no" && !hasPhone);
        return matchesTab && matchesSearch && matchesType && matchesPhone;
      })
      .map((event) => ({
        id: event.id,
        name: event.name,
        kind: "revelao" as const,
        createdAt: event.created_at,
        startsAt: event.upload_start_time,
        endsAt: event.reveal_time || event.upload_end_time,
      }));

    const captainsEntries = adminActiveTab === "others"
      ? captainsEvents
        .filter((event) => {
          const matchesSearch = !search
            || event.name.toLowerCase().includes(search)
            || (event.owner_email || "").toLowerCase().includes(search);
          const matchesType = adminTypeFilter === "all" || adminTypeFilter === "Capitanes";
          const hasPhone = Boolean(event.owner_phone);
          const matchesPhone = adminPhoneFilter === "all"
            || (adminPhoneFilter === "yes" && hasPhone)
            || (adminPhoneFilter === "no" && !hasPhone);
          return matchesSearch && matchesType && matchesPhone;
        })
        .map((event) => ({
          id: event.id,
          name: event.name,
          kind: "captains" as const,
          createdAt: event.created_at,
          startsAt: event.start_time,
          endsAt: event.end_time,
        }))
      : [];

    return [...revelaoEntries, ...captainsEntries];
  }, [events, captainsEvents, adminSearch, adminTypeFilter, adminPhoneFilter, adminActiveTab]);

  if (isLoading) {
    return (
      <div className="admin-demo2-shell min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("events.loading")}</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="admin-demo2-shell min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-muted-foreground">{t("events.loadError")}</p>
        <Button
          onClick={() => {
            setIsLoading(true);
            setLoadError(false);
            void loadData();
          }}
        >
          {t("events.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-demo2-shell min-h-screen bg-background p-4 md:p-6" data-scroll-container>
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 w-full">
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground"
                data-scroll-anchor
              >
                {isDemoMode ? t("events.titleDemo") : t("events.title")}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {isSuperAdmin ? (
                  <>
                    <Button
                      className="gap-2"
                      onClick={() => navigate(`${pathPrefix}/event-form`)}
                    >
                      <Plus className="w-4 h-4" />
                      {t("events.new")}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setRedeemGeneratorOpen(true)}
                    >
                      <KeyRound className="w-4 h-4" />
                      Generar código
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => setGiftDialogOpen(true)}
                    >
                      <Gift className="w-4 h-4" />
                      Regalar Revelao
                    </Button>
                  </>
                ) : null}
                {isSuperAdmin ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigate("/admin/capitanes")}
                    aria-label="Capitanes"
                    title="Capitanes"
                    className="rounded-full font-bold"
                  >
                    <span className="text-sm leading-none">C</span>
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setAccountOpen(true)}
                  aria-label="Cuenta"
                  className="rounded-full"
                >
                  <User className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              {!adminEventId && !isSuperAdmin && (
                <Button
                  className="gap-2 flex-1 sm:flex-initial"
                  onClick={() => {
                    setPricingStep("plans");
                    setPricingOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {t("events.new")}
                </Button>
              )}
            </div>
          </div>

        {!isSuperAdmin && pendingRedeem ? (
          <Card className="p-5 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Tienes un evento {pendingRedeem.planLabel} pendiente de canjear.
              </p>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => navigate(`${pathPrefix}/redeem/${pendingRedeem.token}`)}
              >
                Crear evento
              </Button>
            </div>
          </Card>
        ) : null}

        {isSuperAdmin ? (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <p className="text-sm font-semibold text-foreground">Vista de eventos</p>
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={adminView === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setAdminView("list")}
                >
                  <List className="h-4 w-4" />
                  Listado
                </Button>
                <Button
                  type="button"
                  variant={adminView === "calendar" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => setAdminView("calendar")}
                >
                  <CalendarDays className="h-4 w-4" />
                  Calendario
                </Button>
              </div>
            </div>
            {adminView === "calendar" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {ADMIN_EVENT_TABS.filter((tab) => tab.value !== "new" || adminTabCounts.new > 0).map((tab) => {
                    const isActive = adminActiveTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setAdminActiveTab(tab.value)}
                        className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                          isActive
                            ? "!border-foreground !bg-foreground !text-background shadow-sm"
                            : "border-border bg-background text-foreground hover:bg-muted"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-background/20 !text-background" : "bg-muted text-muted-foreground"}`}>
                          {adminTabCounts[tab.value]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <Input
                      value={adminSearch}
                      onChange={(event) => setAdminSearch(event.target.value)}
                      placeholder="Buscar por nombre o email"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={adminTypeFilter}
                      onChange={(event) => setAdminTypeFilter(event.target.value as typeof adminTypeFilter)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      aria-label="Filtrar por tipo"
                    >
                      <option value="all">Todos los tipos</option>
                      <option value="Demo">Demo</option>
                      <option value="Start">Start</option>
                      <option value="Plus">Plus</option>
                      <option value="Pro">Pro</option>
                      <option value="Capitanes">Capitanes</option>
                    </select>
                    <select
                      value={adminPhoneFilter}
                      onChange={(event) => setAdminPhoneFilter(event.target.value as typeof adminPhoneFilter)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      aria-label="Filtrar por teléfono"
                    >
                      <option value="all">Con y sin teléfono</option>
                      <option value="yes">Con teléfono</option>
                      <option value="no">Sin teléfono</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mostrando {filteredCalendarEvents.length} eventos con los filtros seleccionados.
                </p>
                <AdminEventsCalendar
                  events={filteredCalendarEvents}
                  onOpen={(event) => {
                    if (event.kind === "captains") {
                      navigate(`/admin/capitanes/${event.id}`, { state: { fromEventManagement: true } });
                    } else {
                      navigate(`${pathPrefix}/event-form/${event.id}`);
                    }
                  }}
                />
              </div>
            ) : (
              <>
            <div className="flex flex-wrap gap-2">
              {ADMIN_EVENT_TABS.filter((tab) => tab.value !== "new" || adminTabCounts.new > 0).map((tab) => {
                const isActive = adminActiveTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setAdminActiveTab(tab.value)}
                    className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
                      isActive
                        ? "!border-foreground !bg-foreground !text-background shadow-sm"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        isActive
                          ? "bg-background/20 !text-background"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {adminTabCounts[tab.value]}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 pt-2">
              <div className="flex-1">
                <Input
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder={t("events.filters.search")}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={adminTypeFilter}
                  onChange={(e) => setAdminTypeFilter(e.target.value as any)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{t("events.filters.typeAll")}</option>
                  <option value="Demo">Demo</option>
                  <option value="Start">Start</option>
                  <option value="Plus">Plus</option>
                  <option value="Pro">Pro</option>
                  <option value="Capitanes">Capitanes</option>
                </select>
                <select
                  value={adminPhoneFilter}
                  onChange={(e) => setAdminPhoneFilter(e.target.value as any)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{t("events.filters.phoneAll")}</option>
                  <option value="yes">{t("events.filters.phoneYes")}</option>
                  <option value="no">{t("events.filters.phoneNo")}</option>
                </select>
              </div>
            </div>
            {selectedEventIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {selectedEventIds.size} seleccionados
                </p>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1">
                        <MoveRight className="w-4 h-4" />
                        Mover a...
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ADMIN_EVENT_MOVE_TARGETS.map((target) => (
                        <DropdownMenuItem
                          key={target.value}
                          onClick={() => handleMoveSelection(target.value)}
                        >
                          {target.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={handleLockSelection}
                  >
                    <Lock className="w-4 h-4" />
                    Bloquear
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelection}
                  >
                    Eliminar selección
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-3 pr-3 font-medium w-10"> </th>
                    <th className="py-3 pr-4 font-medium">ID</th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("name")}>
                      {t("events.table.name")}
                    </th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("type")}>
                      {t("events.table.type")}
                    </th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("start")}>
                      {t("events.table.created")}
                    </th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("creation")}>
                      Creación
                    </th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("email")}>
                      {t("events.table.email")}
                    </th>
                    <th className="py-3 pr-4 font-medium">{t("events.statusLabel")}</th>
                    <th className="py-3 pr-4 font-medium">Contenido</th>
                    <th className="py-3 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdminEvents.map((event) => {
                    const { photos: photoCount, videos: videoCount, audios: audioCount } = getMediaCounts(event);
                    const { photos: photoLimit, videos: videoLimit, audios: audioLimit } = getMediaLimits(event);
                    const statusInfo = getEventStatus(
                      event.upload_start_time,
                      event.upload_end_time,
                      event.reveal_time,
                      event.expiry_date
                    );
                    return (
                      <tr
                        key={event.id}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer border-b transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none last:border-b-0"
                        onClick={() => navigate(`${pathPrefix}/event-form/${event.id}`)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.key === "Enter") navigate(`${pathPrefix}/event-form/${event.id}`);
                        }}
                      >
                        <td className="py-3 pr-3">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.has(event.id)}
                            onChange={() => toggleEventSelection(event.id)}
                            onClick={(clickEvent) => clickEvent.stopPropagation()}
                            onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {event.event_number ?? "-"}
                        </td>
                        <td className="py-3 pr-4 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {isEventDeletionLocked(event) ? (
                              <Lock className="w-3.5 h-3.5 text-foreground/80" />
                            ) : null}
                            <span>{truncate(event.name, 26)}</span>
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3.25rem] h-6 rounded-full border px-2 text-xs font-semibold whitespace-nowrap ${getPlanType(event.max_photos).color}`}
                          >
                            {getPlanType(event.max_photos).label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {event.upload_start_time
                            ? formatInTimeZone(new Date(event.upload_start_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy")
                            : "-"}
                        </td>
                        <td className="py-3 pr-4">
                          {format(new Date(event.created_at), "dd/MM/yyyy", { locale: dateLocale })}
                        </td>
                        <td className="py-3 pr-4">
                          {getAdminOwnerEmail(event) ? truncate(getAdminOwnerEmail(event) || "", 18) : "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}
                          >
                            {t(`events.status.${statusInfo.status}`)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <MediaUsageTag
                            photoCount={photoCount}
                            photoLimit={photoLimit}
                            videoCount={videoCount}
                            videoLimit={videoLimit}
                            audioCount={audioCount}
                            audioLimit={audioLimit}
                          />
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant={getAdminEventNote(event) ? "default" : "outline"}
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Notas del evento"
                              onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                openAdminNote(event);
                              }}
                            >
                              <MessageSquareText className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
              <p className="text-xs text-muted-foreground">
                {t("events.paginationInfo", {
                  from: superAdminEvents.length === 0 ? 0 : (adminPage - 1) * pageSize + 1,
                  to: Math.min(adminPage * pageSize, superAdminEvents.length),
                  total: superAdminEvents.length,
                })}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={adminPageSize}
                  onChange={(e) =>
                    setAdminPageSize(e.target.value === "all" ? "all" : Number(e.target.value))
                  }
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={100}>100</option>
                  <option value="all">Ver todos</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={adminPage === 1 || adminPageSize === "all"}
                  onClick={() => setAdminPage((prev) => Math.max(1, prev - 1))}
                >
                  {t("events.paginationPrev")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {adminPage} / {totalAdminPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={adminPage >= totalAdminPages || adminPageSize === "all"}
                  onClick={() => setAdminPage((prev) => Math.min(totalAdminPages, prev + 1))}
                >
                  {t("events.paginationNext")}
                </Button>
              </div>
            </div>
              </>
            )}
          </Card>
        ) : events.length === 0 && captainsEvents.length === 0 && folders.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {t("events.none")}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Folders first */}
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                isExpanded={expandedFolders.has(folder.id)}
                onToggle={() => toggleFolder(folder.id)}
                onDelete={loadData}
                onUpdate={loadData}
                eventCount={eventsByFolder[folder.id]?.length || 0}
                folderEvents={eventsByFolder[folder.id]?.map(e => ({
                  id: e.id,
                  name: e.name,
                  password_hash: e.password_hash,
                  reveal_time: e.reveal_time,
                  upload_start_time: e.upload_start_time,
                  upload_end_time: e.upload_end_time,
                  expiry_date: e.expiry_date,
                })) || []}
              >
                {eventsByFolder[folder.id]?.length > 0 ? (
                  renderEventTable(eventsByFolder[folder.id])
                ) : (
                  <Card className="p-6 text-center bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                      {t("folder.empty")}
                    </p>
                  </Card>
                )}
              </FolderCard>
            ))}

            {/* Unfiled events */}
            {mixedUnfiledEvents.length > 0 && (
              <div className="space-y-4">
                {folders.length > 0 && (
                  <h2 className="text-lg font-medium text-muted-foreground mt-6 mb-2">
                    {t("events.unfiled")}
                  </h2>
                )}
                {mixedUnfiledEvents.map((item) =>
                  item.kind === "revelao"
                    ? renderEventCard(item.event)
                    : renderCaptainsEventCard(item.event)
                )}
              </div>
            )}
          </div>
        )}

        {shouldShowPricing ? (
          <Card className="p-6 md:p-8 border-[#f06a5f]/40 bg-[#f06a5f]/5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#f06a5f] uppercase tracking-wide">
                  {t("events.demoBadge")}
                </p>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                  {t("events.demoText")}
                </h2>
                <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                  {t("events.demoPlans")}
                </p>
              </div>
              <Button
                size="lg"
                className="w-full lg:w-auto bg-[#f06a5f] text-white hover:bg-[#e95f54]"
                onClick={() => navigate(`${pathPrefix}/planes`)}
              >
                {t("plans.title")}
              </Button>
            </div>
          </Card>
        ) : null}
      </div>

      {/* Gallery Preview Modal */}
      <GalleryPreviewModal
        open={!!previewEvent}
        onOpenChange={(open) => !open && setPreviewEvent(null)}
        eventId={previewEvent?.id || ""}
        eventName={previewEvent?.name || ""}
        eventDescription={previewEvent?.description}
        backgroundImageUrl={previewEvent?.background_image_url}
        customImageUrl={previewEvent?.custom_image_url}
        fontFamily={previewEvent?.font_family}
        fontSize={previewEvent?.font_size}
        filterType={previewEvent?.filter_type}
        allowPhotoSharing={previewEvent?.allow_photo_sharing !== false}
      />

      <Dialog open={pricingOpen} onOpenChange={setPricingOpen}>
        <DialogContent
          className="w-screen h-[100dvh] max-h-[100dvh] rounded-none p-4 sm:p-6 sm:rounded-lg sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-7xl xl:max-w-[1480px]"
        >
          <div className="flex items-center gap-2 sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPricingOpen(false)}
              aria-label={t("events.redeemBack")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-foreground">{t("pricing.newEventTitle")}</span>
          </div>
          <DialogHeader className="hidden sm:block">
            <DialogTitle>{t("pricing.newEventTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("pricing.newEventSubtitle")}
            </p>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-80px)] sm:max-h-[80vh] overflow-y-auto pr-1">
            {pricingStep === "plans" ? (
              <>
                <div className="mx-auto w-full max-w-6xl">
                  <PricingPreview
                    showHeader={false}
                    mobileLayout="carousel"
                    hideDemo={false}
                    demoUrl={`${pathPrefix}/nuevoeventodemo2?from_private=1`}
                  />
                </div>
                <div className="mt-6 space-y-3 text-sm text-muted-foreground text-center">
                  <p>
                    {t("events.pricingContactPrefix")}{" "}
                    <a className="text-primary font-medium hover:underline" href="mailto:revelao.cam@gmail.com">
                      {t("events.pricingContactEmail")}
                    </a>{" "}
                    {t("events.pricingContactMiddle")}{" "}
                    <a
                      className="text-primary font-medium hover:underline"
                      href={`https://wa.me/34695834018?text=${encodeURIComponent(t("pricing.whatsappMessage"))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("events.pricingContactWhatsapp")}
                    </a>
                    .
                  </p>
                  <p>
                    {t("events.redeemInlinePrefix")}{" "}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => {
                        setRedeemError(null);
                        setRedeemCode("");
                        setPricingStep("redeem");
                      }}
                    >
                      {t("events.redeemInlineLink")}
                    </button>
                    .
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  className="px-0 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setPricingStep("plans")}
                >
                  {t("events.redeemBack")}
                </Button>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("events.redeemDescription")}
                  </p>
                  <input
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value)}
                    placeholder={t("events.redeemPlaceholder")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  {redeemError ? (
                    <p className="text-sm text-destructive">{redeemError}</p>
                  ) : null}
                  <Button className="w-full" onClick={handleRedeemSubmit}>
                    {t("events.redeemAction")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={redeemGeneratorOpen} onOpenChange={setRedeemGeneratorOpen}>
        <DialogContent className="admin-demo2-shell max-w-md w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Generar código de Revelao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo de evento</label>
              <select
                value={redeemPlan}
                onChange={(e) => setRedeemPlan(e.target.value as any)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="demo">Demo</option>
                <option value="small">Start</option>
                <option value="medium">Plus</option>
                <option value="xxl">Pro</option>
              </select>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleGenerateRedeem}
              disabled={isGeneratingRedeem}
            >
              {isGeneratingRedeem ? "Generando..." : "Generar código"}
            </Button>
            {generatedRedeem ? (
              <div className="space-y-3 rounded-md border border-border bg-muted/50 px-3 py-3 text-sm">
                <div>
                  Código: <span className="font-semibold">{generatedRedeem}</span>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleCopyRedeem}
                >
                  Copiar enlace
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={giftDialogOpen} onOpenChange={handleGiftDialogChange}>
        <DialogContent className="admin-demo2-shell max-w-md w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Regalar Revelao</DialogTitle>
          </DialogHeader>
          {giftExistingConfirmationOpen ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Esta cuenta ya existe</p>
                <p className="mt-2">
                  Esta cuenta ya existe. Utilizará la contraseña anterior que ya tiene, no la que tú le has generado.
                </p>
              </div>
              {giftError ? <p className="text-sm text-destructive">{giftError}</p> : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setGiftExistingConfirmationOpen(false);
                    setGiftError(null);
                  }}
                  disabled={isSendingGift}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSendGift(true)}
                  disabled={isSendingGift}
                >
                  {isSendingGift ? "Enviando..." : "Continuar"}
                </Button>
              </div>
            </div>
          ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="giftPlan" className="text-sm font-medium text-foreground">Plan</label>
              <select
                id="giftPlan"
                value={giftForm.planId}
                onChange={(event) => setGiftForm((previous) => ({ ...previous, planId: event.target.value as GiftPlanId }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={isSendingGift}
              >
                <option value="demo">Demo</option>
                <option value="small">Start</option>
                <option value="medium">Plus</option>
                <option value="xxl">Pro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="giftRecipientName" className="text-sm font-medium text-foreground">Nombre</label>
              <Input
                id="giftRecipientName"
                value={giftForm.recipientName}
                onChange={(event) => setGiftForm((previous) => ({ ...previous, recipientName: event.target.value }))}
                placeholder="Nombre del destinatario"
                disabled={isSendingGift}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="giftEmail" className="text-sm font-medium text-foreground">Email</label>
              <Input
                id="giftEmail"
                type="email"
                value={giftForm.email}
                onChange={(event) => setGiftForm((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="destinatario@email.com"
                disabled={isSendingGift}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="giftPassword" className="text-sm font-medium text-foreground">Contraseña</label>
              <div className="flex gap-2">
                <Input
                  id="giftPassword"
                  type="text"
                  value={giftForm.password}
                  onChange={(event) => setGiftForm((previous) => ({ ...previous, password: event.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                  disabled={isSendingGift}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-2"
                  onClick={() => setGiftForm((previous) => ({ ...previous, password: generateGiftPassword() }))}
                  disabled={isSendingGift}
                >
                  <RefreshCw className="h-4 w-4" />
                  Generar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">“Generar” crea una contraseña alfanumérica de 8 caracteres.</p>
            </div>
            {giftError ? <p className="text-sm text-destructive">{giftError}</p> : null}
            <Button
              type="button"
              className="w-full gap-2"
              onClick={() => void handleSendGift(false)}
              disabled={isSendingGift}
            >
              <Gift className="h-4 w-4" />
              {isSendingGift ? "Enviando..." : "Enviar"}
            </Button>
          </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!noteEvent}
        onOpenChange={(open) => {
          if (!open) {
            setNoteEvent(null);
            setAdminNoteDraft("");
          }
        }}
      >
        <DialogContent className="admin-demo2-shell max-w-lg w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>
              Nota interna{noteEvent ? ` · ${noteEvent.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={adminNoteDraft}
              onChange={(event) => setAdminNoteDraft(event.target.value)}
              placeholder="Añade una nota interna para este evento..."
              className="min-h-[180px]"
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNoteEvent(null);
                  setAdminNoteDraft("");
                }}
                disabled={adminNoteSaving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveAdminNote} disabled={adminNoteSaving}>
                {adminNoteSaving ? "Guardando..." : "Guardar nota"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="admin-demo2-shell max-w-sm w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Cuenta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {currentUserEmail || "-"}
            </div>
            <label className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={marketingOptIn}
                disabled={marketingSaving}
                onChange={(e) => handleMarketingToggle(e.target.checked)}
              />
              <span>
                Comunicaciones comerciales por email
                <span className="block text-xs text-muted-foreground">
                  Puedes activarlas o desactivarlas cuando quieras.
                </span>
              </span>
            </label>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setAccountOpen(false);
                navigate(`${pathPrefix}/reset-password`);
              }}
            >
              Reset contraseña
            </Button>
            <Button className="w-full" variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
            <Button className="w-full" variant="destructive" onClick={handleDeleteAccount}>
              Eliminar cuenta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdSummary} onOpenChange={(open) => !open && setCreatedSummary(null)}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>{t("events.createSummaryTitle")}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {t("events.createSummarySubtitle")}
            </p>
          </DialogHeader>
          {createdSummary && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">{createdSummary.name}</p>
              <p>
                <span className="font-medium">{t("events.table.email")}:</span>{" "}
                {createdSummary.owner_email || "-"}
              </p>
              <MediaUsageTag
                photoCount={0}
                photoLimit={createdSummary.max_photos ?? "∞"}
                videoCount={0}
                videoLimit={createdSummary.max_videos ?? "∞"}
                audioCount={0}
                audioLimit={createdSummary.max_audios ?? "∞"}
              />
              <p>
                <span className="font-medium">{t("events.startLabel")}:</span>{" "}
                {createdSummary.upload_start_time
                  ? formatInTimeZone(new Date(createdSummary.upload_start_time), "Europe/Madrid", "dd/MM/yyyy HH:mm")
                  : "-"}
              </p>
              <p>
                <span className="font-medium">{t("events.endLabel")}:</span>{" "}
                {createdSummary.upload_end_time
                  ? formatInTimeZone(new Date(createdSummary.upload_end_time), "Europe/Madrid", "dd/MM/yyyy HH:mm")
                  : "-"}
              </p>
              <p>
                <span className="font-medium">{t("events.revealDate")}:</span>{" "}
                {createdSummary.reveal_time
                  ? formatInTimeZone(new Date(createdSummary.reveal_time), "Europe/Madrid", "dd/MM/yyyy HH:mm")
                  : "-"}
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  const url = `https://acceso.revelao.cam/events/${createdSummary.password_hash}`;
                  navigator.clipboard.writeText(url);
                  toast({
                    title: t("events.copyUrl"),
                    description: t("events.copyUrlDesc"),
                  });
                }}
              >
                {t("events.copyUrl")}
              </Button>
            </div>
          )}
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
                alt={t("events.qrAlt")}
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

export default EventManagement;
