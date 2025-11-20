import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Film } from "lucide-react";

interface Photo {
  id: string;
  image_url: string;
  captured_at: string;
}

const Gallery = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }

    loadPhotos();
  }, [eventId, navigate]);

  const loadPhotos = async () => {
    if (!eventId) return;

    try {
      const isAdmin = localStorage.getItem("isAdmin") === "true";
      
      let query = supabase
        .from("photos")
        .select("*")
        .eq("event_id", eventId)
        .order("captured_at", { ascending: true });

      // Admin mode bypasses RLS by using service role key isn't available in client
      // Instead, we'll use a different approach - fetch with current permissions
      // but the RLS policy will allow it if it's past reveal time
      const { data, error } = await query;

      if (error) {
        // If error is due to RLS and we're admin, we need to handle differently
        if (isAdmin && error.code === 'PGRST116') {
          // No rows returned due to RLS - this is expected for admin before reveal
          // We'll need to create an edge function or modify RLS for admin access
          console.log("Admin mode: Photos not yet revealed");
        } else {
          throw error;
        }
      }

      // Get signed URLs for each photo
      const photosWithUrls = await Promise.all(
        (data || []).map(async (photo) => {
          const { data: urlData } = await supabase.storage
            .from("event-photos")
            .createSignedUrl(photo.image_url, 3600);

          return {
            ...photo,
            signedUrl: urlData?.signedUrl || "",
          };
        })
      );

      setPhotos(photosWithUrls as any);
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

  const handleLogout = () => {
    localStorage.removeItem("eventId");
    localStorage.removeItem("eventName");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 p-4 bg-card border-b border-border backdrop-blur-sm bg-opacity-95">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Film className="w-4 h-4" />
              {photos.length} {photos.length === 1 ? "foto revelada" : "fotos reveladas"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 pb-20">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <p className="text-muted-foreground">Revelando fotos...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4 animate-fade-in">
              <Film className="w-16 h-16 text-muted-foreground" />
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">
                  Aún no hay fotos
                </h2>
                <p className="text-muted-foreground">
                  Las fotos aparecerán aquí cuando se alcance la hora de revelado
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg overflow-hidden bg-card border-4 border-border shadow-lg animate-reveal"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <img
                    src={(photo as any).signedUrl}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-sm text-muted-foreground">
            📸 Todas las fotos del evento reveladas
          </p>
        </div>
      </div>
    </div>
  );
};

export default Gallery;