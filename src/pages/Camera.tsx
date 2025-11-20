import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera as CameraIcon, LogOut, Image } from "lucide-react";

const Camera = () => {
  const [photoCount, setPhotoCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }

    loadPhotoCount();
  }, [eventId, navigate]);

  const loadPhotoCount = async () => {
    if (!eventId) return;

    const { count } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    setPhotoCount(count || 0);
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !eventId) return;

    setIsUploading(true);

    try {
      const fileName = `${eventId}/${Date.now()}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(fileName, file);

      if (uploadError) {
        toast({
          title: "Error",
          description: "No se pudo guardar la foto",
          variant: "destructive",
        });
        return;
      }

      // Save photo record
      const { error: dbError } = await supabase.from("photos").insert({
        event_id: eventId,
        image_url: fileName,
      });

      if (dbError) {
        console.error("Error saving photo record:", dbError);
      }

      setPhotoCount((prev) => prev + 1);
      
      toast({
        title: "¡Foto capturada!",
        description: "Se revelará mañana junto con las demás",
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la foto",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("eventId");
    localStorage.removeItem("eventName");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center bg-card border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Image className="w-4 h-4" />
            {photoCount} {photoCount === 1 ? "foto" : "fotos"}
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
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-32 h-32 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <CameraIcon className="w-16 h-16 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Captura tus momentos
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Toma fotos durante el evento. Se revelarán todas juntas mañana a las 12:00
            </p>
          </div>
          <Button
            onClick={handleTakePhoto}
            disabled={isUploading}
            className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full transition-all hover:scale-105 disabled:opacity-50"
          >
            {isUploading ? "Subiendo..." : "Hacer foto"}
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default Camera;