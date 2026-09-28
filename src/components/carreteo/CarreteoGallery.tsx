import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Film, LayoutGrid, LayoutList, Share2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  carreteoApi,
  downloadCarreteoPhoto,
  shareCarreteoPhoto,
  type CarreteoGalleryPhoto,
  type PublicCarreteoEvent,
} from "@/lib/carreteo";

const PAGE_SIZE = 60;

type GalleryResponse = { event: PublicCarreteoEvent; photos: CarreteoGalleryPhoto[]; total: number; hasMore: boolean };

export const CarreteoGallery = ({ event }: { event: PublicCarreteoEvent }) => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<CarreteoGalleryPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<"normal" | "grid">("normal");
  const [manualView, setManualView] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  const [selected, setSelected] = useState<CarreteoGalleryPhoto | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (nextPage: number) => {
    const response = await carreteoApi<GalleryResponse>({ action: "gallery", slug: event.slug, page: nextPage, limit: PAGE_SIZE });
    setPhotos((current) => (nextPage === 0 ? response.photos : [...current, ...response.photos]));
    setTotal(response.total);
    setHasMore(response.hasMore);
    setPage(nextPage);
    return response;
  }, [event.slug]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await loadPage(0);
        if (!manualView) setViewMode(response.total > 30 ? "grid" : "normal");
      } catch {
        toast({ title: "No se pudo cargar la galería", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // Solo la primera carga decide la vista por defecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPage]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || loadingMore) return;
      setLoadingMore(true);
      void loadPage(page + 1).catch(() => setHasMore(false)).finally(() => setLoadingMore(false));
    }, { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadPage, loading, loadingMore, page]);

  const fileName = (photo: CarreteoGalleryPhoto) => `carreteo-${event.slug}-${photo.id.slice(0, 8)}.jpg`;
  const effectiveView = isDesktop ? "grid" : viewMode;
  const revealedText = event.revealAt
    ? `Revelado el ${formatInTimeZone(new Date(event.revealAt), event.timezone, "dd/MM/yyyy 'a las' HH:mm")}`
    : "Carrete revelado";
  const statsText = `${total} ${total === 1 ? "foto" : "fotos"}`;

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch {
      toast({ title: "No se pudo completar la acción", variant: "destructive" });
    }
  };

  const openPhoto = (photo: CarreteoGalleryPhoto) => setSelected(photo);

  return (
    <div className="min-h-screen bg-background">
      {event.coverImageUrl ? (
        <header className="relative w-full">
          <div className="relative h-[50vh] min-h-[320px] max-h-[450px] w-full overflow-hidden rounded-b-3xl">
            <img src={event.coverImageUrl} alt={event.name} className="absolute inset-0 h-full w-full object-cover object-top lg:object-center" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          </div>
          <div className="relative -mt-20 px-6 pb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{event.name}</h1>
            <p className="text-sm tracking-wide text-muted-foreground">{revealedText}</p>
            <p className="mt-1 text-sm text-muted-foreground">{statsText}</p>
          </div>
        </header>
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{event.name}</h1>
          <p className="mt-2 text-sm tracking-wide text-muted-foreground">{revealedText}</p>
          <p className="mt-1 text-sm text-muted-foreground">{statsText}</p>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-6">
        {!isDesktop && photos.length > 0 ? (
          <div className="mb-4">
            <div className="mx-auto flex w-full max-w-2xl rounded-2xl bg-muted p-1">
              {(["normal", "grid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setManualView(true); setViewMode(mode); }}
                  className={`flex flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    viewMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  aria-label={mode === "normal" ? "Vista de lista" : "Vista de cuadrícula"}
                >
                  {mode === "normal" ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className={effectiveView === "grid" ? "w-full" : "mx-auto max-w-7xl px-6"}>
        {loading ? (
          <div className="grid grid-cols-3 gap-[2px] sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {Array.from({ length: 18 }, (_, index) => <div key={index} className="aspect-square animate-pulse bg-muted" />)}
          </div>
        ) : photos.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
            <Film className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold uppercase tracking-tight text-foreground">Carrete vacío</h2>
              <p className="text-sm tracking-wide text-muted-foreground">Nadie hizo fotos con esta cámara.</p>
            </div>
          </div>
        ) : effectiveView === "grid" ? (
          <div className="grid grid-cols-3 gap-[2px] bg-white sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => openPhoto(photo)}
                className="group relative aspect-square cursor-pointer overflow-hidden bg-muted outline-none focus-visible:ring focus-visible:ring-primary/60"
              >
                <img src={photo.thumbnailUrl} alt="Foto del carrete" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 pb-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => openPhoto(photo)}
                  className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl outline-none focus-visible:ring focus-visible:ring-primary/60 md:aspect-[3/4] lg:aspect-[5/7]"
                >
                  <img src={photo.imageUrl} alt="Foto del carrete" loading="lazy" className="h-full w-full object-cover" />
                </button>
              </div>
            ))}
          </div>
        )}
        {hasMore && !loading ? (
          <div ref={observerTarget} className="flex justify-center py-8">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Cargando…</p>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl bg-card p-6">
          <DialogTitle className="sr-only">Foto del carrete</DialogTitle>
          {selected ? (
            <div className="space-y-4">
              <img
                src={selected.imageUrl}
                alt="Foto ampliada"
                className="h-auto max-h-[70vh] w-full rounded-lg object-contain"
                onError={(errorEvent) => { errorEvent.currentTarget.src = selected.thumbnailUrl; }}
              />
              <div className="space-y-3 rounded-lg bg-muted/50 p-4">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 uppercase tracking-wide" onClick={() => void runAction(() => downloadCarreteoPhoto(selected.imageUrl, fileName(selected)))}>
                    <Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Descargar</span>
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1 uppercase tracking-wide" onClick={() => void runAction(() => shareCarreteoPhoto(selected.imageUrl, fileName(selected)))}>
                    <Share2 className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Compartir</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};
