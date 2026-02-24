import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Edit, Copy, Download, Eye, LogOut, ArrowLeft } from "lucide-react";
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
}

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [folders, setFolders] = useState<EventFolder[]>([]);
  const [eventPhotoCounts, setEventPhotoCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [adminEventId] = useState(() => localStorage.getItem("adminEventId"));
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
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
  const [adminTypeFilter, setAdminTypeFilter] = useState<"all" | "Demo" | "Start" | "Plus" | "Pro">("all");
  const [adminPhoneFilter, setAdminPhoneFilter] = useState<"all" | "yes" | "no">("all");
  const [adminSort, setAdminSort] = useState<{ key: "name" | "type" | "created_at" | "email" | "photos"; direction: "asc" | "desc" }>({
    key: "created_at",
    direction: "desc",
  });
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState<number | "all">(30);
  // pageSize computed after superAdminEvents below
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [redeemPlan, setRedeemPlan] = useState<"demo" | "small" | "medium" | "xxl">("small");
  const [generatedRedeem, setGeneratedRedeem] = useState<string | null>(null);
  const [isGeneratingRedeem, setIsGeneratingRedeem] = useState(false);
  const [createdSummary, setCreatedSummary] = useState<{
    id: string;
    name: string;
    password_hash: string;
    upload_start_time: string | null;
    upload_end_time: string | null;
    reveal_time: string;
    max_photos: number | null;
    owner_email: string | null;
  } | null>(null);
  
  // Dialogs

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t, dateLocale, pathPrefix } = useAdminI18n();

  useEffect(() => {
    const checkAuth = async () => {
      // If accessed via admin password, allow access without full auth
      if (adminEventId) {
        loadData();
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(`${pathPrefix}/admin-login`);
        return;
      }
      loadData();
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

  useEffect(() => {
    const loadUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserEmail(user?.email ?? null);
    };
    loadUserEmail();
  }, []);

  useEffect(() => {
    const created = (location.state as any)?.createdEvent;
    if (created) {
      setCreatedSummary(created);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const loadData = async () => {
    try {
      // If we have an adminEventId, only load that specific event
      if (adminEventId) {
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("id", adminEventId)
          .single();

        if (eventError) throw eventError;

        setFolders([]);
        setEvents(eventData ? [eventData as Event] : []);

        if (eventData) {
          setEventPhotoCounts({ [eventData.id]: (eventData as any).photo_count || 0 });
        }
    } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate(`${pathPrefix}/admin-login`);
          return;
        }

        const isAdminUser = (session.user?.email || "").toLowerCase() === "revelao.cam@gmail.com";
        setIsSuperAdmin(isAdminUser);

        const { data: eventsPayload, error: eventsError } = await supabase.functions.invoke(
          isAdminUser ? "admin-events" : "my-events",
          { method: "GET" },
        );
        if (eventsError) throw eventsError;

        const fetchedEvents = (eventsPayload?.events || []) as Event[];
        setEvents(fetchedEvents);

        if (isAdminUser) {
          setFolders([]);
          setPendingRedeem(null);
        } else {
          const { data: pendingPayload } = await supabase.functions.invoke(
            "redeem-pending",
            { method: "GET" },
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

        if (fetchedEvents?.length) {
          const counts: Record<string, number> = {};
          fetchedEvents.forEach((event) => {
            counts[event.id] = event.photo_count || 0;
          });
          setEventPhotoCounts(counts);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
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

  const handleAdminSort = (key: "name" | "type" | "created_at" | "email" | "photos") => {
    setAdminSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const superAdminEvents = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();
    let list = events.filter((event) => {
      const matchesSearch =
        !search ||
        event.name.toLowerCase().includes(search) ||
        (event.owner_email || "").toLowerCase().includes(search);
      const planLabel = getPlanType(event.max_photos).label;
      const matchesType = adminTypeFilter === "all" || planLabel === adminTypeFilter;
      const hasPhone = !!event.owner_phone;
      const matchesPhone =
        adminPhoneFilter === "all" ||
        (adminPhoneFilter === "yes" && hasPhone) ||
        (adminPhoneFilter === "no" && !hasPhone);
      return matchesSearch && matchesType && matchesPhone;
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
            return (event.owner_email || "").toLowerCase();
          case "photos":
            return eventPhotoCounts[event.id] || 0;
          case "created_at":
          default:
            return event.created_at || "";
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
  }, [events, adminSearch, adminTypeFilter, adminPhoneFilter, adminSort, eventPhotoCounts]);

  const pageSize = adminPageSize === "all" ? superAdminEvents.length || 1 : adminPageSize;

  useEffect(() => {
    setAdminPage(1);
  }, [adminSearch, adminTypeFilter, adminPhoneFilter, adminSort, adminPageSize]);

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

  const handleDeleteSelection = async () => {
    const ids = Array.from(selectedEventIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(`¿Eliminar ${ids.length} evento(s) seleccionados?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .in("id", ids);

      if (error) throw error;
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

  const handleCopyUrl = async (password: string) => {
    const eventUrl = `https://acceso.revelao.cam/events/${password}`;
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

  const getEventQrUrl = (eventId: string) =>
    localStorage.getItem(`event-qr-url-${eventId}`) ||
    supabase.storage
      .from("event-photos")
      .getPublicUrl(`event-qr/qr-${eventId}.png`).data.publicUrl;

  const handleDownloadQR = async (eventUrl: string, eventName: string, eventId: string) => {
    try {
      const qrUrl = getEventQrUrl(eventId);
      const response = await fetch(qrUrl);
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
    const photoCount = eventPhotoCounts[event.id] || 0;
    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const statusInfo = getEventStatus(
      event.upload_start_time,
      event.upload_end_time,
      event.reveal_time,
      event.expiry_date
    );
    const qrStorageUrl = getEventQrUrl(event.id);
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
            {t("events.statusLabel")}: {statusLabel}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[160px_1fr] gap-4 md:gap-6 items-start">
            {/* QR Code Section */}
            <div className="space-y-3 flex flex-col items-center lg:items-start">
              <p className="text-sm font-medium text-foreground">{t("events.qrLabel")}</p>
              <div className="bg-white p-3 rounded-xl border border-border w-fit">
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
                  handleDownloadQR(eventUrl, event.name, event.id)
                }
                className="w-full gap-2"
              >
                <Download className="w-4 h-4" />
                {t("events.downloadQrAction")}
              </Button>
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
              </div>
            </div>

            {/* Event Info */}
            <div className="flex-1 space-y-4 w-full text-sm text-muted-foreground">
              <p>
                <span className="font-medium">{t("events.createdLabel")}:</span>{" "}
                {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: dateLocale })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Fotos:</span>{" "}
                {photoCount}{event.max_photos ? ` / ${event.max_photos}` : ""}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewEvent(effectiveEvent)}
                  className="h-6 px-2 text-xs gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {t("events.preview")}
                </Button>
              </div>
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t("events.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {isDemoMode ? t("events.titleDemo") : t("events.title")}
              </h1>
              {currentUserEmail ? (
                <span className="text-sm text-muted-foreground hidden sm:inline">{currentUserEmail}</span>
              ) : null}
            </div>
            <div className="flex items-center justify-between w-full sm:hidden">
              <span className="text-sm text-muted-foreground">
                {currentUserEmail ? truncateEmail(currentUserEmail, 10) : "-"}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAccountOpen(true)}
                aria-label="Cuenta"
                className="rounded-full"
              >
                <span className="text-sm font-semibold">
                  {(currentUserEmail?.trim()?.[0] || "?").toUpperCase()}
                </span>
              </Button>
            </div>

            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setAccountOpen(true)}
                aria-label="Cuenta"
                className="hidden sm:inline-flex rounded-full"
              >
                <span className="text-sm font-semibold">
                  {(currentUserEmail?.trim()?.[0] || "?").toUpperCase()}
                </span>
              </Button>
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
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Generar código de canje</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={redeemPlan}
                  onChange={(e) => setRedeemPlan(e.target.value as any)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="demo">Demo</option>
                  <option value="small">Start</option>
                  <option value="medium">Plus</option>
                  <option value="xxl">Pro</option>
                </select>
                <Button
                  variant="default"
                  className="gap-2"
                  onClick={handleGenerateRedeem}
                  disabled={isGeneratingRedeem}
                >
                  {isGeneratingRedeem ? "Generando..." : "Generar"}
                </Button>
                {generatedRedeem ? (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleCopyRedeem}
                  >
                    Copiar enlace
                  </Button>
                ) : null}
              </div>
            </div>
            {generatedRedeem ? (
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                Código: <span className="font-semibold">{generatedRedeem}</span>
              </div>
            ) : null}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
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
              <div className="lg:ml-auto">
                <Button
                  className="gap-2"
                  onClick={() => navigate(`${pathPrefix}/event-form`)}
                >
                  <Plus className="w-4 h-4" />
                  {t("events.new")}
                </Button>
              </div>
            </div>
            {selectedEventIds.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  {selectedEventIds.size} seleccionados
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelection}
                >
                  Eliminar selección
                </Button>
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
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
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("created_at")}>
                      {t("events.table.created")}
                    </th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("email")}>
                      {t("events.table.email")}
                    </th>
                    <th className="py-3 pr-4 font-medium">{t("events.table.phone")}</th>
                    <th className="py-3 pr-4 font-medium cursor-pointer" onClick={() => handleAdminSort("photos")}>
                      {t("events.table.photos")}
                    </th>
                    <th className="py-3 font-medium">{t("events.table.more")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdminEvents.map((event, index) => {
                    const photoCount = eventPhotoCounts[event.id] || 0;
                    const maxPhotos = event.max_photos ?? "-";
                    return (
                      <tr key={event.id} className="border-b last:border-b-0">
                        <td className="py-3 pr-3">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.has(event.id)}
                            onChange={() => toggleEventSelection(event.id)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {(adminPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="py-3 pr-4 font-medium">{truncate(event.name, 26)}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center justify-center w-9 h-6 rounded-full border text-xs font-semibold ${getPlanType(event.max_photos).color}`}
                          >
                            {getPlanType(event.max_photos).label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {event.created_at
                            ? format(new Date(event.created_at), "dd/MM/yyyy")
                            : "-"}
                        </td>
                        <td className="py-3 pr-4">
                          {event.owner_email ? truncate(event.owner_email, 18) : "-"}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center gap-2 text-sm font-medium ${
                              event.owner_phone ? "text-emerald-600" : "text-rose-500"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                event.owner_phone ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {event.owner_phone ? t("events.table.phoneYes") : t("events.table.phoneNo")}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Button
                            variant="ghost"
                            className="px-0 text-primary hover:text-primary"
                            onClick={() => setPreviewEvent(event)}
                          >
                            {photoCount}/{maxPhotos}
                          </Button>
                        </td>
                        <td className="py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => navigate(`${pathPrefix}/event-form/${event.id}`)}
                          >
                            <span>{t("events.more")}</span>
                          </Button>
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
          </Card>
        ) : events.length === 0 && folders.length === 0 ? (
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
            {eventsByFolder.unfiled.length > 0 && (
              <div className="space-y-4">
                {folders.length > 0 && (
                  <h2 className="text-lg font-medium text-muted-foreground mt-6 mb-2">
                    {t("events.unfiled")}
                  </h2>
                )}
                {renderEventTable(eventsByFolder.unfiled)}
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
        <DialogContent className="w-screen h-[100dvh] max-h-[100dvh] rounded-none p-4 sm:p-6 sm:rounded-lg sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-5xl">
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
                <PricingPreview showHeader={false} mobileLayout="stack" />
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

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-sm w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Cuenta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {currentUserEmail || "-"}
            </div>
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
              <p>
                <span className="font-medium">{t("events.table.photos")}:</span>{" "}
                {createdSummary.max_photos ?? "-"}
              </p>
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

    </div>
  );
};

export default EventManagement;
