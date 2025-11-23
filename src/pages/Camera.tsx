import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Image } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import cameraIcon from "@/assets/camera.png";
import prohibidoIcon from "@/assets/prohibido.png";
import { compressImage } from "@/lib/imageCompression";
import ShareDialog from "@/components/ShareDialog";
const Camera = () => {
  const [photoCount, setPhotoCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [revealTime, setRevealTime] = useState<string>("");
  const [uploadStartTime, setUploadStartTime] = useState<string>("");
  const [uploadEndTime, setUploadEndTime] = useState<string>("");
  const [countdown, setCountdown] = useState<string>("");
  const [revealCountdown, setRevealCountdown] = useState<string>("");
  const [startCountdown, setStartCountdown] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");
  const [eventPassword, setEventPassword] = useState<string>("");
  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }
    loadEventData();
    loadPhotoCount();
  }, [eventId, navigate]);

  // Countdown to reveal time when event has ended
  useEffect(() => {
    if (!revealTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const reveal = new Date(revealTime);
      const distance = reveal.getTime() - now.getTime();
      if (distance < 0) {
        setRevealCountdown("¡Las fotos ya están reveladas!");
        clearInterval(interval);
        return;
      }
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor(distance % (1000 * 60 * 60) / (1000 * 60));
      const seconds = Math.floor(distance % (1000 * 60) / 1000);
      setRevealCountdown(`Quedan ${hours} horas, ${minutes} minutos y ${seconds} segundos para que se revelen las fotos. ¡Qué nervios!`);
    }, 1000);
    return () => clearInterval(interval);
  }, [revealTime]);

  // Countdown to start time when event hasn't started
  useEffect(() => {
    if (!uploadStartTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const start = new Date(uploadStartTime);
      const distance = start.getTime() - now.getTime();
      if (distance < 0) {
        setStartCountdown("");
        clearInterval(interval);
        return;
      }
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor(distance % (1000 * 60 * 60) / (1000 * 60));
      const seconds = Math.floor(distance % (1000 * 60) / 1000);
      setStartCountdown(`Quedan ${hours} horas, ${minutes} minutos y ${seconds} segundos para que comience el evento`);
    }, 1000);
    return () => clearInterval(interval);
  }, [uploadStartTime]);

  const loadEventData = async () => {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("events")
      .select("reveal_time, upload_start_time, upload_end_time, password_hash")
      .eq("id", eventId)
      .single();
    if (data && !error) {
      setRevealTime(data.reveal_time);
      setUploadStartTime(data.upload_start_time || "");
      setUploadEndTime(data.upload_end_time || "");
      setEventPassword(data.password_hash || "");
    }
  };

  // Update countdown every second
  useEffect(() => {
    if (!uploadEndTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const endTime = new Date(uploadEndTime);
      const distance = endTime.getTime() - now.getTime();
      if (distance < 0) {
        setCountdown("Evento finalizado");
        clearInterval(interval);
        return;
      }
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor(distance % (1000 * 60 * 60) / (1000 * 60));
      const seconds = Math.floor(distance % (1000 * 60) / 1000);

      // Determine if it's today or tomorrow
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(endTime);
      endDate.setHours(0, 0, 0, 0);
      let dateLabel = "";
      if (endDate.getTime() === today.getTime()) {
        dateLabel = "hoy";
      } else if (endDate.getTime() === tomorrow.getTime()) {
        dateLabel = "mañana";
      } else {
        dateLabel = `el día ${format(endTime, "dd/MM/yyyy", {
          locale: es
        })}`;
      }
      const formattedTime = format(endTime, "HH:mm", {
        locale: es
      });
      setCountdown(`Puedes subir todas las fotos que quieras hasta ${dateLabel} a las ${formattedTime} horas. ¡Solo quedan ${hours} horas, ${minutes} minutos y ${seconds} segundos!`);
    }, 1000);
    return () => clearInterval(interval);
  }, [uploadEndTime]);
  const loadPhotoCount = async () => {
    if (!eventId) return;
    const {
      count
    } = await supabase.from("photos").select("*", {
      count: "exact",
      head: true
    }).eq("event_id", eventId);
    setPhotoCount(count || 0);
  };
  const handleTakePhoto = () => {
    // Check if upload period is valid
    const now = new Date();
    const startTime = uploadStartTime ? new Date(uploadStartTime) : null;
    const endTime = uploadEndTime ? new Date(uploadEndTime) : null;
    if (startTime && now < startTime) {
      toast({
        title: "Evento no iniciado",
        description: `El evento comienza el ${format(startTime, "dd/MM/yyyy 'a las' HH:mm", {
          locale: es
        })}`,
        variant: "destructive"
      });
      return;
    }
    if (endTime && now > endTime) {
      // Already handled by UI, but extra validation
      return;
    }
    fileInputRef.current?.click();
  };
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !eventId) return;
    setIsUploading(true);
    try {
      // Compress image to max 1MB
      const compressedFile = await compressImage(file, 1);
      
      const fileName = `${eventId}/${Date.now()}.jpg`;

      // Upload to storage
      const {
        error: uploadError
      } = await supabase.storage.from("event-photos").upload(fileName, compressedFile);
      if (uploadError) {
        toast({
          title: "Error",
          description: "No se pudo guardar la foto",
          variant: "destructive"
        });
        return;
      }

      // Save photo record
      const {
        error: dbError
      } = await supabase.from("photos").insert({
        event_id: eventId,
        image_url: fileName
      });
      if (dbError) {
        console.error("Error saving photo record:", dbError);
      }
      setPhotoCount(prev => prev + 1);
      toast({
        title: "¡Foto capturada!",
        description: "Se revelará mañana junto con las demás"
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la foto",
        variant: "destructive"
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

  // Check if event has ended or hasn't started
  const now = new Date();
  const startTime = uploadStartTime ? new Date(uploadStartTime) : null;
  const endTime = uploadEndTime ? new Date(uploadEndTime) : null;
  const hasNotStarted = startTime && now < startTime;
  const hasEnded = endTime && now > endTime;

  // Event hasn't started yet
  if (hasNotStarted) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="w-24 h-24 mx-auto flex items-center justify-center p-2 mb-4" style={{
          imageRendering: 'pixelated'
        }}>
          <img src={prohibidoIcon} alt="Cámara prohibida" style={{
            imageRendering: 'pixelated'
          }} className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">El evento aún no ha comenzado</h1>
          <p className="text-muted-foreground text-lg">
            El período para subir fotos comenzará pronto.
          </p>
          {uploadStartTime && <>
              <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                <p className="text-sm text-muted-foreground">El evento comenzará:</p>
                <p className="text-xl font-bold text-foreground">
                  {format(new Date(uploadStartTime), "dd 'de' MMMM 'a las' HH:mm", {
                locale: es
              })}
                </p>
              </div>
              {startCountdown && <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-primary font-semibold">
                    {startCountdown}
                  </p>
                </div>}
            </>}
          <Button onClick={handleLogout} variant="outline" className="mt-4">
            <LogOut className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </div>
      </div>;
  }

  if (hasEnded) {
    return <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md animate-fade-in">
        <div className="w-24 h-24 mx-auto flex items-center justify-center p-2 mb-4" style={{
          imageRendering: 'pixelated'
        }}>
          <img src={prohibidoIcon} alt="Cámara prohibida" style={{
            imageRendering: 'pixelated'
          }} className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Evento finalizado</h1>
          <p className="text-muted-foreground text-lg">
            El período para subir fotos ha terminado.
          </p>
          {revealTime && <>
              <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                <p className="text-sm text-muted-foreground">Las fotos se revelarán:</p>
                <p className="text-xl font-bold text-foreground">
                  {format(new Date(revealTime), "dd 'de' MMMM 'a las' HH:mm", {
                locale: es
              })}
                </p>
              </div>
              {revealCountdown && <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-primary font-semibold">
                    {revealCountdown}
                  </p>
                </div>}
            </>}
          <Button onClick={handleLogout} variant="outline" className="mt-4">
            <LogOut className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center bg-card border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Image className="w-4 h-4" />
            Ya hay {photoCount} fotos subidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {eventPassword && (
            <ShareDialog eventPassword={eventPassword} eventName={eventName || ""} />
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
        <div className="text-center space-y-6 animate-fade-in">
          <button onClick={handleTakePhoto} disabled={isUploading} className="w-24 h-24 mx-auto flex items-center justify-center cursor-pointer transition-all hover:scale-105 disabled:opacity-50 p-2" style={{
          imageRendering: 'pixelated'
        }}>
            <img src={cameraIcon} alt="Cámara" style={{
            imageRendering: 'pixelated'
          }} className="w-full h-full object-contain" />
          </button>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-foreground">
              ¡Captura la magia!
            </h2>
            {countdown && <div className="bg-card border border-border rounded-lg p-4 max-w-lg mx-auto">
                <p className="text-primary font-semibold text-sm">
                  {countdown}
                </p>
              </div>}
            <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {revealTime && <>
                  {(() => {
                const reveal = new Date(revealTime);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const revealDate = new Date(reveal);
                revealDate.setHours(0, 0, 0, 0);
                let dateLabel = "";
                if (revealDate.getTime() === today.getTime()) {
                  dateLabel = "Hoy";
                } else if (revealDate.getTime() === tomorrow.getTime()) {
                  dateLabel = "Mañana";
                } else {
                  dateLabel = `El ${format(reveal, "dd/MM/yyyy", {
                    locale: es
                  })}`;
                }
                return `${dateLabel} a las ${format(reveal, "HH:mm", {
                  locale: es
                })} todas las imágenes serán reveladas. Accede con la misma contraseña y vuelve a revivir esta experiencia 📸✨`;
              })()}
                </>}
            </p>
          </div>
          <Button onClick={handleTakePhoto} disabled={isUploading} className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-x1 transition-all hover:scale-105 disabled:opacity-50 rounded-xl">
            {isUploading ? "Subiendo..." : "Hacer foto"}
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
    </div>;
};
export default Camera;