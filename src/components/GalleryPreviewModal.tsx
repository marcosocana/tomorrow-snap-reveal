import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { X, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getFontById, loadGoogleFont, getEventFontFamily, EventFontFamily } from "@/lib/eventFonts";
import { getFilterClass, FilterType } from "@/lib/photoFilters";

interface Photo {
  id: string;
  image_url: string;
  captured_at: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const { toast } = useToast();

  // Load font
  useEffect(() => {
    if (fontFamily && fontFamily !== "system") {
      const font = getFontById(fontFamily as EventFontFamily);
      loadGoogleFont(font);
    }
  }, [fontFamily]);

  useEffect(() => {
    if (open && eventId) {
      loadPhotos();
    }
  }, [open, eventId]);

  const loadPhotos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("id, image_url, captured_at")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      setPhotos(data || []);
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

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("¿Eliminar esta foto?")) return;
    
    try {
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);

      if (error) throw error;

      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
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

  const fontStyle = getEventFontFamily(fontFamily as any);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Vista previa de galería</span>
              <span className="text-sm font-normal text-muted-foreground">
                ({photos.length} fotos)
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
                      src={photo.image_url}
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
        </DialogContent>
      </Dialog>

      {/* Expanded Photo Modal */}
      {selectedPhoto && (
        <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <div className="relative">
              <img
                src={selectedPhoto.image_url}
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
                  onClick={() => window.open(selectedPhoto.image_url, "_blank")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePhoto(selectedPhoto.id)}
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
