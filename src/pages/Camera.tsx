import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera as CameraIcon, LogOut, Image } from "lucide-react";

const Camera = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Error",
        description: "No se pudo acceder a la cámara",
        variant: "destructive",
      });
    }
  };

  const takePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !eventId) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const fileName = `${eventId}/${Date.now()}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(fileName, blob);

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

      // Stop camera after taking photo
      stopCamera();
    }, "image/jpeg");
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
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
        {!isCapturing ? (
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
              onClick={startCamera}
              className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full transition-all hover:scale-105"
            >
              Hacer foto
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-6 animate-fade-in">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-h-[70vh]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex gap-4">
              <Button
                onClick={stopCamera}
                variant="outline"
                className="flex-1 h-14 text-lg rounded-xl border-2"
              >
                Cancelar
              </Button>
              <Button
                onClick={takePhoto}
                className="flex-1 h-14 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
              >
                Capturar
              </Button>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Camera;