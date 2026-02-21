import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Edit, Copy, Download, Eye, LogOut } from "lucide-react";
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
              {event.max_photos === 10 && (
                <span className="text-xs font-semibold uppercase tracking-wide bg-[#f06a5f]/10 text-[#f06a5f] px-2 py-1 rounded-full">
                  {t("events.demoBadge")}
                </span>
              )}
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
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full lg:w-auto justify-end">
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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {isDemoMode ? t("events.titleDemo") : t("events.title")}
            </h1>
          </div>

          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`${pathPrefix}/logout`)}
            >
              <LogOut className="w-4 h-4" />
              {t("events.logout")}
            </Button>
            {!adminEventId && (
              <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => navigate(`${pathPrefix}/event-form`)}>
                <Plus className="w-4 h-4" />
                {t("events.new")}
              </Button>
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

    </div>
  );
};

export default EventManagement;
