import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  ChevronLeft,
  ChevronRight,
  Images,
  Maximize,
  Minimize,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { supabasePublic } from "@/integrations/supabase/publicClient";

type SlideshowEvent = {
  id: string;
  name: string;
  owner_id: string | null;
  language: string | null;
  password_hash: string;
  limits_json: unknown;
};

type SlideshowPhoto = {
  id: string;
  event_id: string;
  image_url: string;
  captured_at: string;
};

const ADMIN_EMAIL = "revelao.cam@gmail.com";
const SLIDE_DURATION_MS = 7000;

const copy = {
  es: {
    loading: "Preparando el slideshow…",
    notFound: "Este slideshow no está disponible.",
    emptyTitle: "Esperando las primeras fotos",
    emptyDescription: "Las fotos aparecerán aquí automáticamente en cuanto se suban al evento.",
    live: "En directo",
    play: "Reproducir",
    pause: "Pausar",
    previous: "Foto anterior",
    next: "Foto siguiente",
    fullscreen: "Pantalla completa",
    exitFullscreen: "Salir de pantalla completa",
    delete: "Eliminar foto",
    deleteConfirm: "¿Seguro que quieres eliminar esta foto? Esta acción no se puede deshacer.",
    deleteSuccess: "Foto eliminada",
    deleteError: "No se pudo eliminar la foto.",
  },
  en: {
    loading: "Preparing the slideshow…",
    notFound: "This slideshow is not available.",
    emptyTitle: "Waiting for the first photos",
    emptyDescription: "Photos will appear here automatically as soon as they are uploaded to the event.",
    live: "Live",
    play: "Play",
    pause: "Pause",
    previous: "Previous photo",
    next: "Next photo",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    delete: "Delete photo",
    deleteConfirm: "Are you sure you want to delete this photo? This action cannot be undone.",
    deleteSuccess: "Photo deleted",
    deleteError: "The photo could not be deleted.",
  },
  it: {
    loading: "Preparazione dello slideshow…",
    notFound: "Questo slideshow non è disponibile.",
    emptyTitle: "In attesa delle prime foto",
    emptyDescription: "Le foto appariranno automaticamente non appena saranno caricate nell'evento.",
    live: "In diretta",
    play: "Riproduci",
    pause: "Pausa",
    previous: "Foto precedente",
    next: "Foto successiva",
    fullscreen: "Schermo intero",
    exitFullscreen: "Esci da schermo intero",
    delete: "Elimina foto",
    deleteConfirm: "Vuoi davvero eliminare questa foto? L'azione non può essere annullata.",
    deleteSuccess: "Foto eliminata",
    deleteError: "Non è stato possibile eliminare la foto.",
  },
} as const;

const getPhotoUrl = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value;
  return supabasePublic.storage.from("event-photos").getPublicUrl(value).data.publicUrl;
};

const getQrImageUrlFromLimits = (raw: unknown) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>).qr_image_url;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const LiveSlideshow = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const [event, setEvent] = useState<SlideshowEvent | null>(null);
  const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [canDelete, setCanDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [qrUrlIndex, setQrUrlIndex] = useState(0);

  const language = event?.language === "en" || event?.language === "it" ? event.language : "es";
  const text = copy[language];

  const loadPhotos = useCallback(async () => {
    if (!eventId) return;
    const { data, error } = await supabasePublic
      .from("photos")
      .select("id,event_id,image_url,captured_at")
      .eq("event_id", eventId)
      .order("captured_at", { ascending: true });
    if (error) throw error;

    const nextPhotos = (data || []) as SlideshowPhoto[];
    setPhotos(nextPhotos);
    setCurrentPhotoId((current) =>
      current && nextPhotos.some((photo) => photo.id === current)
        ? current
        : nextPhotos[0]?.id ?? null,
    );
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setIsLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const { data, error } = await supabasePublic
          .from("events")
          .select("id,name,owner_id,language,password_hash,limits_json")
          .eq("id", eventId)
          .maybeSingle();
        if (error) throw error;
        if (!active) return;
        setEvent(data as SlideshowEvent | null);
        if (data) await loadPhotos();
      } catch (error) {
        console.error("Error loading live slideshow:", error);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();

    return () => {
      active = false;
    };
  }, [eventId, loadPhotos]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabasePublic
      .channel(`live-slideshow-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "photos", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const photo = payload.new as SlideshowPhoto;
          setPhotos((current) => {
            if (current.some((item) => item.id === photo.id)) return current;
            return [...current, photo].sort(
              (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime(),
            );
          });
          setCurrentPhotoId(photo.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "photos" },
        () => {
          void loadPhotos();
        },
      )
      .subscribe();

    return () => {
      void supabasePublic.removeChannel(channel);
    };
  }, [eventId, loadPhotos]);

  useEffect(() => {
    if (!event) return;
    const checkPermission = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      setCanDelete(
        Boolean(user && (user.id === event.owner_id || user.email?.toLowerCase() === ADMIN_EMAIL)),
      );
    };
    void checkPermission();
  }, [event]);

  const currentIndex = useMemo(
    () => Math.max(0, photos.findIndex((photo) => photo.id === currentPhotoId)),
    [currentPhotoId, photos],
  );
  const currentPhoto = photos[currentIndex] ?? null;
  const eventUrl = `https://acceso.revelao.cam/events/${event?.password_hash ?? ""}`;
  const qrUrlCandidates = useMemo(
    () =>
      [
        getQrImageUrlFromLimits(event?.limits_json),
        eventId
          ? supabasePublic.storage
              .from("event-photos")
              .getPublicUrl(`event-qr/qr-${eventId}.png`).data.publicUrl
          : null,
      ].filter((value): value is string => Boolean(value)),
    [event?.limits_json, eventId],
  );
  const qrImageUrl = qrUrlCandidates[qrUrlIndex] || "";

  useEffect(() => {
    setQrUrlIndex(0);
  }, [eventId, event?.limits_json]);

  const showPhotoAt = useCallback(
    (index: number) => {
      if (photos.length === 0) return;
      const normalized = (index + photos.length) % photos.length;
      setCurrentPhotoId(photos[normalized].id);
    },
    [photos],
  );

  useEffect(() => {
    if (!isPlaying || photos.length < 2) return;
    const timer = window.setInterval(() => showPhotoAt(currentIndex + 1), SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [currentIndex, isPlaying, photos.length, showPhotoAt]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "ArrowLeft") showPhotoAt(currentIndex - 1);
      if (keyboardEvent.key === "ArrowRight") showPhotoAt(currentIndex + 1);
      if (keyboardEvent.key === " ") {
        keyboardEvent.preventDefault();
        setIsPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, showPhotoAt]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  };

  const deleteCurrentPhoto = async () => {
    if (!eventId || !currentPhoto || !canDelete || !window.confirm(text.deleteConfirm)) return;
    try {
      setIsDeleting(true);
      const { data, error } = await supabase.functions.invoke("slideshow-delete-photo", {
        body: { eventId, photoId: currentPhoto.id },
      });
      if (error || data?.error) throw error || new Error(data.error);
      const nextPhotos = photos.filter((photo) => photo.id !== currentPhoto.id);
      setPhotos(nextPhotos);
      setCurrentPhotoId(nextPhotos[Math.min(currentIndex, nextPhotos.length - 1)]?.id ?? null);
      toast({ title: text.deleteSuccess });
    } catch (error) {
      console.error("Error deleting slideshow photo:", error);
      toast({ title: text.deleteError, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-black text-white">{text.loading}</main>;
  }

  if (!event) {
    return <main className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center text-white">{text.notFound}</main>;
  }

  return (
    <main className="relative flex h-[100dvh] w-screen overflow-hidden bg-black text-white">
      {currentPhoto ? (
        <img
          key={currentPhoto.id}
          src={getPhotoUrl(currentPhoto.image_url)}
          alt={`${event.name} · ${currentIndex + 1}`}
          className="h-full w-full animate-fade-in object-contain"
        />
      ) : (
        <div className="m-auto flex max-w-lg flex-col items-center gap-4 px-6 text-center">
          <Images className="h-14 w-14 text-white/60" />
          <h1 className="text-2xl font-semibold">{text.emptyTitle}</h1>
          <p className="text-white/65">{text.emptyDescription}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/75 via-black/10 to-black/85" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 pb-12 md:p-6 md:pb-16">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold md:text-xl">{event.name}</h1>
          <p className="mt-1 inline-flex items-center gap-2 text-xs text-white/75 md:text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {text.live}
          </p>
        </div>
        {photos.length > 0 ? <p className="text-sm tabular-nums text-white/75">{currentIndex + 1} / {photos.length}</p> : null}
      </div>

      {photos.length > 1 ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75 md:left-6"
            onClick={() => showPhotoAt(currentIndex - 1)}
            aria-label={text.previous}
            title={text.previous}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75 md:right-6"
            onClick={() => showPhotoAt(currentIndex + 1)}
            aria-label={text.next}
            title={text.next}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      ) : null}

      <div className="absolute inset-x-0 bottom-40 flex items-center justify-center gap-2 p-4 pt-12 md:bottom-0 md:p-6 md:pt-16">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="rounded-full bg-white/15 text-white hover:bg-white/25"
          onClick={() => setIsPlaying((value) => !value)}
          aria-label={isPlaying ? text.pause : text.play}
          title={isPlaying ? text.pause : text.play}
          disabled={photos.length < 2}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="rounded-full bg-white/15 text-white hover:bg-white/25"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? text.exitFullscreen : text.fullscreen}
          title={isFullscreen ? text.exitFullscreen : text.fullscreen}
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </Button>
        {canDelete && currentPhoto ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="rounded-full"
            onClick={deleteCurrentPhoto}
            aria-label={text.delete}
            title={text.delete}
            disabled={isDeleting}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      <div className="absolute bottom-3 right-3 z-20 rounded-[20px] bg-white p-3 text-center text-gray-950 shadow-2xl md:bottom-5 md:right-5 md:rounded-[30px] md:p-5">
        <p className="mb-2 text-sm font-bold md:mb-4 md:text-xl">¡Haz una foto!</p>
        <div className="rounded-2xl bg-white p-1 md:rounded-[20px] md:p-2">
          {qrImageUrl ? (
            <img
              src={qrImageUrl}
              alt={`QR de ${event.name}`}
              className="h-24 w-24 object-contain sm:h-28 sm:w-28 md:h-[154px] md:w-[154px]"
              onError={() => setQrUrlIndex((current) => current + 1)}
            />
          ) : (
            <QRCodeSVG
              value={eventUrl}
              size={154}
              level="H"
              includeMargin
              className="h-24 w-24 sm:h-28 sm:w-28 md:h-[154px] md:w-[154px]"
              aria-label={`QR de ${event.name}`}
            />
          )}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-20 rounded-[20px] bg-white p-3 shadow-2xl md:bottom-5 md:left-5 md:rounded-[30px] md:p-4">
        <img
          src="/LogoTransparent.png"
          alt="Revelao"
          className="h-auto w-20 object-contain sm:w-24 md:w-32"
        />
      </div>
    </main>
  );
};

export default LiveSlideshow;
