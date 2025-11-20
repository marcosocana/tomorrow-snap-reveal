import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Film, X, Trash2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import confetti from "canvas-confetti";

interface Photo {
  id: string;
  image_url: string;
  captured_at: string;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
}

const PHOTOS_PER_PAGE = 12;

const Gallery = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");

  const loadPhotos = useCallback(async (pageNum: number) => {
    if (!eventId) return;

    try {
      const from = pageNum * PHOTOS_PER_PAGE;
      const to = from + PHOTOS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("photos")
        .select("*", { count: 'exact' })
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Get signed URLs for thumbnails and full quality
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo) => {
          const { data: thumbnailData } = await supabase.storage
            .from("event-photos")
            .createSignedUrl(photo.image_url, 3600, {
              transform: {
                width: 400,
                height: 400,
                quality: 60
              }
            });

          const { data: fullQualityData } = await supabase.storage
            .from("event-photos")
            .createSignedUrl(photo.image_url, 3600);

          return {
            ...photo,
            thumbnailUrl: thumbnailData?.signedUrl || "",
            fullQualityUrl: fullQualityData?.signedUrl || "",
          };
        })
      );

      setPhotos(prev => pageNum === 0 ? photosWithUrls as any : [...prev, ...photosWithUrls as any]);
      setHasMore(count ? (from + photosWithUrls.length) < count : false);
    } catch (error) {
      console.error("Error loading photos:", error);
      // Silently handle errors (like 416 when reaching end of data)
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }

    // Always scroll to top when gallery loads
    window.scrollTo(0, 0);

    // Check if this is the first visit to gallery for this event
    const hasSeenWelcome = localStorage.getItem(`gallery-welcome-${eventId}`);
    if (!hasSeenWelcome) {
      setShowWelcome(true);
      localStorage.setItem(`gallery-welcome-${eventId}`, "true");
      
      // Trigger confetti
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#f5e6d3', '#d4a574', '#8b4513']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#f5e6d3', '#d4a574', '#8b4513']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }

    loadPhotos(0);
  }, [eventId, navigate, loadPhotos]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadPhotos(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page, loadPhotos]);

  const handleLogout = () => {
    localStorage.removeItem("eventId");
    localStorage.removeItem("eventName");
    navigate("/");
  };

  const handleDeletePhoto = async (photoId: string, imageUrl: string) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("event-photos")
        .remove([imageUrl]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);

      if (dbError) throw dbError;

      setPhotos(photos.filter(p => p.id !== photoId));
      setSelectedPhoto(null);
      
      toast({
        title: "Foto eliminada",
        description: "La foto se eliminó correctamente",
      });
    } catch (error) {
      console.error("Error deleting photo:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la foto",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPhoto = async (signedUrl: string, capturedAt: string) => {
    try {
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foto-${format(new Date(capturedAt), "dd-MM-yyyy-HHmm")}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Descargando foto",
        description: "La foto se está descargando",
      });
    } catch (error) {
      console.error("Error downloading photo:", error);
      toast({
        title: "Error",
        description: "No se pudo descargar la foto",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{eventName}</h1>
            <p className="text-sm text-muted-foreground mt-2 tracking-wide uppercase">
              Total ({photos.length})
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="uppercase text-xs tracking-wider"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      <main className="py-12 pt-36">
        <div className="max-w-7xl mx-auto px-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-muted-foreground uppercase tracking-wide">Cargando fotos...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
              <Film className="w-16 h-16 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">
                  Aún no hay fotos
                </h2>
                <p className="text-muted-foreground text-sm tracking-wide">
                  Las fotos aparecerán aquí cuando se alcance la hora de revelado
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative bg-muted cursor-pointer"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <div className="aspect-square overflow-hidden bg-muted relative film-grain">
                      <img
                        src={(photo as any).thumbnailUrl}
                        alt="Foto del evento"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 retro-filter"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute inset-0 bg-muted animate-pulse" style={{ zIndex: -1 }} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white text-xs uppercase tracking-wider font-medium">
                        {format(new Date(photo.captured_at), "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div ref={observerTarget} className="flex justify-center py-8">
                  <p className="text-muted-foreground uppercase tracking-wide text-sm">
                    Cargando más fotos...
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Welcome Modal */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-md p-8 bg-card text-center">
          <div className="space-y-4 animate-scale-in">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-bold text-foreground">
              ¡Ya están las fotos del evento reveladas!
            </h2>
            <p className="text-muted-foreground text-lg">
              Disfrútalas
            </p>
            <Button
              onClick={() => setShowWelcome(false)}
              className="w-full mt-6 uppercase tracking-wide"
            >
              Ver fotos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Detail Modal */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl p-6 bg-card">
          {selectedPhoto && (
            <div className="space-y-4">
              <div className="relative film-grain">
                <img
                  src={(selectedPhoto as any).fullQualityUrl}
                  alt="Foto ampliada"
                  className="w-full h-auto max-h-[70vh] object-contain retro-filter rounded-lg"
                  onError={(e) => {
                    e.currentTarget.src = (selectedPhoto as any).thumbnailUrl;
                  }}
                />
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <p className="text-foreground text-sm uppercase tracking-wider">
                  {format(new Date(selectedPhoto.captured_at), "dd MMM yyyy - HH:mm", { locale: es })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDownloadPhoto((selectedPhoto as any).fullQualityUrl, selectedPhoto.captured_at)}
                    className="uppercase tracking-wide flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePhoto(selectedPhoto.id, selectedPhoto.image_url)}
                    className="uppercase tracking-wide flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gallery;