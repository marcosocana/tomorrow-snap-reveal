import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getFontById, loadGoogleFont, getEventFontFamily, EventFontFamily } from "@/lib/eventFonts";
import { getFilterClass, FilterType } from "@/lib/photoFilters";

const PHOTOS_PER_PAGE = 50;

interface Photo {
  id: string;
  image_url: string;
  captured_at: string;
  thumbnailUrl?: string;
  fullQualityUrl?: string;
}

interface GalleryPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventDescription?: string | null;
  backgroundImageUrl?: string | null;
  customImageUrl?: string | null;
  fontFamily?: string;
  fontSize?: string;
  filterType?: FilterType;
}

export const GalleryPreviewModal = ({
  open,
  onOpenChange,
  eventId,
  eventName,
  eventDescription,
  backgroundImageUrl,
  customImageUrl,
  fontFamily = "system",
  fontSize = "text-3xl",
  filterType = "vintage",
}: GalleryPreviewModalProps) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const { toast } = useToast();

  const totalPages = Math.ceil(totalPhotos / PHOTOS_PER_PAGE);

  // Load font
  useEffect(() => {
    if (fontFamily && fontFamily !== "system") {
      const font = getFontById(fontFamily as EventFontFamily);
      loadGoogleFont(font);
    }
  }, [fontFamily]);

  useEffect(() => {
    if (open && eventId) {
      setCurrentPage(0);
      loadPhotos(0);
    }
  }, [open, eventId]);

  const loadPhotos = async (page: number) => {
    setIsLoading(true);
    try {
      const from = page * PHOTOS_PER_PAGE;
      const to = from + PHOTOS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("photos")
        .select("id, image_url, captured_at", { count: "exact" })
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true })
        .range(from, to);

      if (error) throw error;

      if (count !== null) {
        setTotalPhotos(count);
      }

      // Generate signed URLs for each photo
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

      setPhotos(photosWithUrls);
    } catch (error) {
      console.error("Error loading photos:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las fotos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      loadPhotos(newPage);
    }
  };

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("event-photos")
        .remove([photo.image_url]);

      if (storageError) throw storageError;

      // Delete from database
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setTotalPhotos((prev) => prev - 1);
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

  const handleDownload = async (photo: Photo) => {
    if (!photo.fullQualityUrl) return;
    
    try {
      const response = await fetch(photo.fullQualityUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foto-${new Date(photo.captured_at).toISOString().slice(0, 10)}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Foto descargada",
        description: "La foto se descargó correctamente",
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

  const fontStyle = getEventFontFamily(fontFamily as any);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Vista previa de galería</span>
              <span className="text-sm font-normal text-muted-foreground">
                ({totalPhotos} fotos)
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Hero Header Preview */}
          <div className="relative h-32 rounded-lg overflow-hidden mb-4 flex-shrink-0">
            {backgroundImageUrl ? (
              <>
                <img
                  src={backgroundImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-white/85" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-background" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <h2 
                className={`${fontSize} font-bold text-foreground leading-tight`}
                style={{ fontFamily: fontStyle }}
              >
                {eventName}
              </h2>
              {eventDescription && (
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line max-w-lg line-clamp-2">
                  {eventDescription}
                </p>
              )}
              {customImageUrl && (
                <img 
                  src={customImageUrl} 
                  alt="" 
                  className="mt-2 max-w-[120px] max-h-[40px] object-contain" 
                />
              )}
            </div>
          </div>

          {/* Photo Grid */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">Cargando fotos...</p>
              </div>
            ) : photos.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-muted-foreground">No hay fotos en este evento</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    <img
                      src={photo.thumbnailUrl || photo.fullQualityUrl}
                      alt=""
                      className={`w-full h-full object-cover ${getFilterClass(filterType)}`}
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-border flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0 || isLoading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i).map((page) => {
                  // Show first, last, current, and pages around current
                  const showPage = 
                    page === 0 || 
                    page === totalPages - 1 || 
                    Math.abs(page - currentPage) <= 1;
                  
                  const showEllipsisBefore = 
                    page === currentPage - 2 && currentPage > 2;
                  const showEllipsisAfter = 
                    page === currentPage + 2 && currentPage < totalPages - 3;

                  if (showEllipsisBefore || showEllipsisAfter) {
                    return (
                      <span key={page} className="px-1 text-muted-foreground">
                        ...
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => handlePageChange(page)}
                      disabled={isLoading}
                    >
                      {page + 1}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1 || isLoading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expanded Photo Modal */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <div className="relative">
              <img
                src={selectedPhoto.fullQualityUrl}
                alt=""
                className={`w-full max-h-[70vh] object-contain ${getFilterClass(filterType)}`}
              />
            </div>
            <div className="p-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {new Date(selectedPhoto.captured_at).toLocaleString("es-ES")}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(selectedPhoto)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePhoto(selectedPhoto)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GalleryPreviewModal;
