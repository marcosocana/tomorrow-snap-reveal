import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Trash2, Edit, Copy, Home, Download, MessageCircle, ChevronDown, RefreshCw, Eye, FolderPlus, MoveHorizontal, CopyPlus, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getCountryByCode } from "@/lib/countries";
import { getLanguageByCode } from "@/lib/translations";
import { QRCodeSVG } from "qrcode.react";
import { FilterType } from "@/lib/photoFilters";
import { getEventStatus } from "@/lib/eventStatus";
import GalleryPreviewModal from "@/components/GalleryPreviewModal";
import FolderCard, { EventFolder } from "@/components/FolderCard";
import MoveEventDialog from "@/components/MoveEventDialog";
import DuplicateEventDialog from "@/components/DuplicateEventDialog";
import DuplicateFolderDialog from "@/components/DuplicateFolderDialog";
import CreateFolderDialog from "@/components/CreateFolderDialog";
import SortableEventList from "@/components/SortableEventList";
import { useAdminI18n } from "@/lib/adminI18n";

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
}

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [folders, setFolders] = useState<EventFolder[]>([]);
  const [eventPhotoCounts, setEventPhotoCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode] = useState(() => localStorage.getItem("isDemoMode") === "true");
  const [adminEventId] = useState(() => localStorage.getItem("adminEventId"));
  const [previewEvent, setPreviewEvent] = useState<Event | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [moveEventDialogOpen, setMoveEventDialogOpen] = useState(false);
  const [duplicateEventDialogOpen, setDuplicateEventDialogOpen] = useState(false);
  const [duplicateFolderDialogOpen, setDuplicateFolderDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<EventFolder | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const navigate = useNavigate();
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
          const { count } = await supabase
            .from("photos")
            .select("*", { count: "exact", head: true })
            .eq("event_id", eventData.id);
          
          setEventPhotoCounts({ [eventData.id]: count || 0 });
        }
    } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate(`${pathPrefix}/admin-login`);
          return;
        }

        const { data: eventsPayload, error: eventsError } = await supabase.functions.invoke("my-events", {
          method: "GET",
        });
        if (eventsError) throw eventsError;

        const fetchedEvents = (eventsPayload?.events || []) as Event[];
        setEvents(fetchedEvents);

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

        // Load photo counts
        if (fetchedEvents) {
          const counts: Record<string, number> = {};
          for (const event of fetchedEvents) {
            const { count, error: countError } = await supabase
              .from("photos")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id);
            
            if (!countError) {
              counts[event.id] = count || 0;
            }
          }
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

  const handleMoveEvent = async (folderId: string | null) => {
    if (!selectedEvent) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ folder_id: folderId } as any)
        .eq("id", selectedEvent.id);

      if (error) throw error;

      toast({
        title: t("events.moveTitle"),
        description: folderId ? t("events.moveDescFolder") : t("events.moveDescRoot"),
      });
      loadData();
    } catch (error) {
      console.error("Error moving event:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.moveError"),
        variant: "destructive",
      });
    }
  };

  const generateSequentialPassword = async (basePassword: string): Promise<string> => {
    // Find all events with similar password pattern
    const { data: existingEvents } = await supabase
      .from("events")
      .select("password_hash")
      .eq("is_demo", isDemoMode);

    if (!existingEvents) return `${basePassword}_1`;

    // Extract base password (remove trailing numbers if any)
    const baseWithoutNumber = basePassword.replace(/_\d+$/, "");
    
    // Find the highest number used
    let maxNumber = 0;
    existingEvents.forEach((e) => {
      if (e.password_hash.startsWith(baseWithoutNumber)) {
        const match = e.password_hash.match(/_(\d+)$/);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxNumber) maxNumber = num;
        }
      }
    });

    return `${baseWithoutNumber}_${maxNumber + 1}`;
  };

  const handleDuplicateEvent = async (folderId: string | null, includePhotos: boolean) => {
    if (!selectedEvent) return;

    try {
      const newPassword = await generateSequentialPassword(selectedEvent.password_hash);

      const { data: eventData, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("id", selectedEvent.id)
        .single();

      if (fetchError) throw fetchError;

      // Remove id and created_at, update password and folder
      const { id, created_at, ...eventCopy } = eventData as any;
      
      const { data: newEvent, error: insertError } = await supabase.from("events").insert({
        ...eventCopy,
        password_hash: newPassword,
        folder_id: folderId,
      }).select().single();

      if (insertError) throw insertError;

      // Duplicate photos if requested
      if (includePhotos && newEvent) {
        const { data: photos, error: photosError } = await supabase
          .from("photos")
          .select("*")
          .eq("event_id", selectedEvent.id);

        if (!photosError && photos && photos.length > 0) {
          const newPhotos = photos.map(({ id, event_id, ...photo }) => ({
            ...photo,
            event_id: newEvent.id,
          }));

          await supabase.from("photos").insert(newPhotos);
        }
      }

      toast({
        title: t("events.duplicateTitle"),
        description: t("events.duplicateDesc", {
          password: newPassword,
          photos: includePhotos ? t("events.duplicateWithPhotos") : "",
        }),
      });
      loadData();
    } catch (error) {
      console.error("Error duplicating event:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.duplicateError"),
        variant: "destructive",
      });
    }
  };

  const handleDuplicateFolder = async (newName: string, includePhotos: boolean) => {
    if (!selectedFolder) return;

    try {
      // Get events in folder
      const folderEvents = events.filter((e) => e.folder_id === selectedFolder.id);

      // Create new folder
      const { data: newFolder, error: folderError } = await supabase
        .from("event_folders")
        .insert({
          name: newName,
          is_demo: isDemoMode,
          custom_image_url: selectedFolder.custom_image_url,
          background_image_url: selectedFolder.background_image_url,
          font_family: selectedFolder.font_family,
          font_size: selectedFolder.font_size,
        })
        .select()
        .single();

      if (folderError) throw folderError;

      // Duplicate each event in the folder
      for (const event of folderEvents) {
        const newPassword = await generateSequentialPassword(event.password_hash);
        const { id, created_at, folder_id, ...eventCopy } = event as any;

        const { data: newEvent, error: eventError } = await supabase
          .from("events")
          .insert({
            ...eventCopy,
            password_hash: newPassword,
            folder_id: newFolder.id,
          })
          .select()
          .single();

        if (eventError) {
          console.error("Error duplicating event:", eventError);
          continue;
        }

        // Duplicate photos if requested
        if (includePhotos && newEvent) {
          const { data: photos, error: photosError } = await supabase
            .from("photos")
            .select("*")
            .eq("event_id", event.id);

          if (!photosError && photos && photos.length > 0) {
            const newPhotos = photos.map(({ id, event_id, ...photo }) => ({
              ...photo,
              event_id: newEvent.id,
            }));

            await supabase.from("photos").insert(newPhotos);
          }
        }
      }

      toast({
        title: t("folder.duplicateTitle"),
        description: t("folder.duplicateDesc", {
          name: newName,
          count: folderEvents.length,
          photos: includePhotos ? t("folder.duplicateWithPhotos") : "",
        }),
      });
      loadData();
    } catch (error) {
      console.error("Error duplicating folder:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("folder.duplicateError"),
        variant: "destructive",
      });
    }
  };

  const getFolderPhotoCount = (folderId: string): number => {
    const folderEvents = events.filter((e) => e.folder_id === folderId);
    return folderEvents.reduce((sum, e) => sum + (eventPhotoCounts[e.id] || 0), 0);
  };

  const handleToggleReveal = async (event: Event, isRevealed: boolean) => {
    try {
      if (isRevealed) {
        const newRevealTime = new Date();
        newRevealTime.setHours(newRevealTime.getHours() + 24);

        const { error } = await supabase
          .from("events")
          .update({ reveal_time: newRevealTime.toISOString() })
          .eq("id", event.id);

        if (error) throw error;

      toast({
        title: t("events.reopenedTitle"),
        description: t("events.reopenedDesc"),
      });
      } else {
        const { error } = await supabase
          .from("events")
          .update({ reveal_time: new Date().toISOString() })
          .eq("id", event.id);

        if (error) throw error;

      toast({
        title: t("events.revealedTitle"),
        description: t("events.revealedDesc"),
      });
      }

      loadData();
    } catch (error) {
      console.error("Error toggling reveal:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.toggleError"),
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm(t("events.confirmDelete"))) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);

      if (error) throw error;

      toast({
        title: t("events.deleteTitle"),
        description: t("events.deleteDesc"),
      });

      loadData();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: t("form.errorTitle"),
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

  const handleCommunicateDemo = async (event: Event) => {
    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const eventTz = event.timezone || "Europe/Madrid";
    
    const uploadStartFormatted = event.upload_start_time 
      ? formatInTimeZone(new Date(event.upload_start_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale })
      : "";
    const uploadEndFormatted = event.upload_end_time 
      ? formatInTimeZone(new Date(event.upload_end_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale })
      : "";
    const revealFormatted = formatInTimeZone(new Date(event.reveal_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale });

    const message = t("events.demoMessage", {
      eventUrl,
      uploadStart: uploadStartFormatted,
      uploadEnd: uploadEndFormatted,
      reveal: revealFormatted,
    });

    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: t("events.messageCopiedTitle"),
        description: t("events.messageCopiedDescDemo"),
      });
    } catch (error) {
      console.error("Error copying message:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.messageCopyError"),
        variant: "destructive",
      });
    }
  };

  const handleCommunicateEvent = async (event: Event) => {
    const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
    const eventTz = event.timezone || "Europe/Madrid";
    
    const uploadStartFormatted = event.upload_start_time 
      ? formatInTimeZone(new Date(event.upload_start_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale })
      : "";
    const uploadEndFormatted = event.upload_end_time 
      ? formatInTimeZone(new Date(event.upload_end_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale })
      : "";
    const revealFormatted = formatInTimeZone(new Date(event.reveal_time), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale });
    const expiryFormatted = event.expiry_date 
      ? formatInTimeZone(new Date(event.expiry_date), eventTz, "dd/MM/yyyy 'a las' HH:mm", { locale: dateLocale })
      : "";

    const message = t("events.eventMessage", {
      eventUrl,
      uploadStart: uploadStartFormatted,
      uploadEnd: uploadEndFormatted,
      reveal: revealFormatted,
      expiry: expiryFormatted || "",
    });

    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: t("events.messageCopiedTitle"),
        description: t("events.messageCopiedDescEvent"),
      });
    } catch (error) {
      console.error("Error copying message:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.messageCopyError"),
        variant: "destructive",
      });
    }
  };

  const handleRedeem = async () => {
    const code = redeemCode.trim().toUpperCase();
    if (code.length !== 16 && code.length !== 36) {
      toast({
        title: t("form.errorTitle"),
        description: t("events.redeemInvalidLength"),
        variant: "destructive",
      });
      return;
    }
    setIsRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke(`redeem-get?token=${code}`, {
        method: "GET",
      });
      if (error || !data?.token) {
        throw error || new Error("INVALID_TOKEN");
      }
      setRedeemOpen(false);
      setRedeemCode("");
      navigate(`${pathPrefix}/redeem/${code}`);
    } catch (error) {
      console.error("Redeem error:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("events.redeemInvalidToken"),
        variant: "destructive",
      });
    } finally {
      setIsRedeeming(false);
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
    const revealTime = new Date(event.reveal_time);
    const now = new Date();
    const isRevealed = now >= revealTime;
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

    return (
      <Card key={event.id} className="p-4 md:p-6">
        <div className="flex flex-col lg:flex-row items-start gap-4 md:gap-6">
          {/* QR Code Section */}
          <div className="flex-shrink-0 space-y-2 w-full lg:w-auto">
            <div className="bg-white p-3 rounded-lg border border-border mx-auto lg:mx-0 w-fit">
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
            {/* Event Status Badge */}
            <div className={`text-center text-sm font-medium px-3 py-1.5 rounded-md ${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusLabel}
            </div>
          </div>

          {/* Event Info */}
          <div className="flex-1 space-y-3 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg md:text-xl font-semibold text-foreground">
                {event.name}
              </h3>
              {(() => {
                const country = getCountryByCode(event.country_code || "ES");
                return country ? (
                  <span className="text-lg" title={country.name}>
                    {country.flag}
                  </span>
                ) : null;
              })()}
              <div className="flex items-center gap-2">
                <Switch
                  checked={isRevealed}
                  onCheckedChange={() => handleToggleReveal(event, isRevealed)}
                />
                <span className="text-sm text-muted-foreground">
                  {isRevealed ? t("events.status.revealed") : t("events.status.notRevealed")}
                </span>
              </div>
            </div>
            
            <div className="space-y-1 text-sm text-muted-foreground">
              {(() => {
                const country = getCountryByCode(event.country_code || "ES");
                return country ? (
                  <p>
                    <span className="font-medium">{t("events.country")}:</span>{" "}
                    {country.flag} {country.name}
                  </p>
                ) : null;
              })()}
              <p>
                <span className="font-medium">{t("events.password")}:</span>{" "}
                {event.password_hash}
              </p>
              {event.admin_password && (
                <p>
                  <span className="font-medium">{t("events.adminPassword")}:</span>{" "}
                  {event.admin_password}
                </p>
              )}
              <div className="flex items-center gap-2">
                <p>
                  <span className="font-medium">{t("events.photoCount")}:</span>{" "}
                  {photoCount}{event.max_photos ? ` / ${event.max_photos}` : ""}
                </p>
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
              {event.max_photos && (
                <p>
                  <span className="font-medium">{t("events.maxPhotos")}:</span>{" "}
                  {event.max_photos}
                </p>
              )}
              {event.upload_start_time && event.upload_end_time && (
                <>
                  <p className="break-words">
                    <span className="font-medium">{t("events.uploadRange")}:</span>{" "}
                    <span className="inline-block">
                      {formatInTimeZone(new Date(event.upload_start_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })} - {formatInTimeZone(new Date(event.upload_end_time), event.timezone || "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                    </span>
                    <span className="text-xs ml-1">({(() => {
                      const country = getCountryByCode(event.country_code || "ES");
                      return country ? `${country.flag} ${country.name}` : t("events.spain");
                    })()})</span>
                  </p>
                  {(event.country_code || "ES") !== "ES" && (
                    <p className="text-xs text-muted-foreground pl-4">
                      🇪🇸 {t("events.inSpain")}: {formatInTimeZone(new Date(event.upload_start_time), "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })} - {formatInTimeZone(new Date(event.upload_end_time), "Europe/Madrid", "dd/MM/yyyy HH:mm", { locale: dateLocale })}
                    </p>
                  )}
                </>
              )}
              <p>
                <span className="font-medium">{t("events.revealDate")}:</span>{" "}
                {formatInTimeZone(revealTime, event.timezone || "Europe/Madrid", "PPP 'a las' HH:mm", { locale: dateLocale })}
                <span className="text-xs ml-1">({(() => {
                  const country = getCountryByCode(event.country_code || "ES");
                  return country ? `${country.flag} ${country.name}` : t("events.spain");
                })()})</span>
              </p>
              {(event.country_code || "ES") !== "ES" && (
                <p className="text-xs text-muted-foreground pl-4">
                  🇪🇸 {t("events.inSpain")}: {formatInTimeZone(revealTime, "Europe/Madrid", "PPP 'a las' HH:mm", { locale: dateLocale })}
                </p>
              )}
              {event.language && event.language !== "es" && (
                <p>
                  <span className="font-medium">{t("events.language")}:</span>{" "}
                  {(() => {
                    const lang = getLanguageByCode(event.language);
                    return lang ? `${lang.flag} ${lang.name}` : event.language;
                  })()}
                </p>
              )}
              {event.expiry_date && (
                <>
                  <p>
                    <span className="font-medium">{t("events.expiryDate")}:</span>{" "}
                    {formatInTimeZone(new Date(event.expiry_date), event.timezone || "Europe/Madrid", "PPP", { locale: dateLocale })}
                  </p>
                  {event.expiry_redirect_url && (
                    <p className="text-xs text-muted-foreground pl-4 break-all">
                      {t("events.expiryRedirect")} {event.expiry_redirect_url}
                    </p>
                  )}
                </>
              )}
              <p>
                <span className="font-medium">{t("events.createdAt")}:</span>{" "}
                {format(new Date(event.created_at), "PPP", { locale: dateLocale })}
              </p>
            </div>

            {/* URL Section */}
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
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-auto justify-end">
            {!adminEventId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("events.communicateEvent")}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => handleCommunicateDemo(event)}>
                    {t("events.communicateDemo")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCommunicateEvent(event)}>
                    {t("events.communicateEvent")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {adminEventId ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => navigate(`${pathPrefix}/event-form/${event.id}`)}
              >
                <Edit className="w-4 h-4" />
                <span>{t("events.edit")}</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span className="hidden sm:inline">{t("events.more")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={() => {
                    setSelectedEvent(event);
                    setMoveEventDialogOpen(true);
                  }}>
                    <MoveHorizontal className="w-4 h-4 mr-2" />
                    {t("folder.move")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedEvent(event);
                    setDuplicateEventDialogOpen(true);
                  }}>
                    <CopyPlus className="w-4 h-4 mr-2" />
                    {t("events.duplicate")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`${pathPrefix}/event-form/${event.id}`)}>
                    <Edit className="w-4 h-4 mr-2" />
                    {t("events.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDeleteEvent(event.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("events.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </Card>
    );
  };

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                localStorage.removeItem("adminEventId");
                navigate(`${pathPrefix}/`);
              }}
              className="rounded-full"
              title={t("events.backHome")}
            >
              <Home className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {isDemoMode ? t("events.titleDemo") : t("events.title")}
            </h1>
          </div>

          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => {
                setIsLoading(true);
                loadData();
              }}
              title={t("events.refresh")}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`${pathPrefix}/logout`)}
            >
              <LogOut className="w-4 h-4" />
              {t("events.logout")}
            </Button>
            {!adminEventId && (
              <>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setRedeemOpen(true)}
                >
                  {t("events.redeemTitle")}
                </Button>
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={() => setCreateFolderOpen(true)}
                >
                  <FolderPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("folder.create")}</span>
                </Button>
                <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => navigate(`${pathPrefix}/event-form`)}>
                  <Plus className="w-4 h-4" />
                  {t("events.new")}
                </Button>
              </>
            )}
          </div>
        </div>

        {events.length === 0 && folders.length === 0 ? (
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
                onDuplicate={() => {
                  setSelectedFolder(folder);
                  setDuplicateFolderDialogOpen(true);
                }}
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
                  <SortableEventList
                    events={eventsByFolder[folder.id]}
                    folderId={folder.id}
                    onReorder={loadData}
                    renderEventCard={renderEventCard}
                  />
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
                {eventsByFolder.unfiled.map(renderEventCard)}
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

      {/* Create Folder Dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        isDemoMode={isDemoMode}
        onCreate={loadData}
      />

      {/* Move Event Dialog */}
      <MoveEventDialog
        open={moveEventDialogOpen}
        onOpenChange={setMoveEventDialogOpen}
        folders={folders}
        currentFolderId={selectedEvent?.folder_id || null}
        onMove={handleMoveEvent}
      />

      {/* Duplicate Event Dialog */}
      <DuplicateEventDialog
        open={duplicateEventDialogOpen}
        onOpenChange={setDuplicateEventDialogOpen}
        folders={folders}
        eventName={selectedEvent?.name || ""}
        eventPassword={selectedEvent?.password_hash || ""}
        photoCount={selectedEvent ? (eventPhotoCounts[selectedEvent.id] || 0) : 0}
        onDuplicate={handleDuplicateEvent}
      />

      {/* Duplicate Folder Dialog */}
      {selectedFolder && (
        <DuplicateFolderDialog
          open={duplicateFolderDialogOpen}
          onOpenChange={setDuplicateFolderDialogOpen}
          folder={selectedFolder}
          eventCount={eventsByFolder[selectedFolder.id]?.length || 0}
          totalPhotoCount={getFolderPhotoCount(selectedFolder.id)}
          onDuplicate={handleDuplicateFolder}
        />
      )}

      <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("events.redeemTitle")}</DialogTitle>
            <DialogDescription>{t("events.redeemDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              placeholder={t("events.redeemPlaceholder")}
              maxLength={16}
            />
            <Button onClick={handleRedeem} disabled={isRedeeming} className="w-full">
              {isRedeeming ? t("form.loading") : t("events.redeemAction")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventManagement;
