import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Image, Share2 } from "lucide-react";
import { format } from "date-fns";
import { es, enUS, it } from "date-fns/locale";
import cameraIcon from "@/assets/camera.png";
import prohibidoIcon from "@/assets/prohibido.png";
import { compressImage } from "@/lib/imageCompression";
import ShareDialog from "@/components/ShareDialog";
import { getTranslations, getEventLanguage, getEventTimezone, getLocalDateInTimezone, Language } from "@/lib/translations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const getDateLocale = (language: Language) => {
  switch (language) {
    case "en": return enUS;
    case "it": return it;
    default: return es;
  }
};

const Camera = () => {
  const [photoCount, setPhotoCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [revealTime, setRevealTime] = useState<string>("");
  const [uploadStartTime, setUploadStartTime] = useState<string>("");
  const [uploadEndTime, setUploadEndTime] = useState<string>("");
  const [customImageUrl, setCustomImageUrl] = useState<string>("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [eventDescription, setEventDescription] = useState<string>("");
  const [countdown, setCountdown] = useState<string>("");
  const [revealCountdown, setRevealCountdown] = useState<string>("");
  const [startCountdown, setStartCountdown] = useState<string>("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");
  const [eventPassword, setEventPassword] = useState<string>("");
  
  // Get translations and timezone
  const language = getEventLanguage();
  const t = getTranslations(language);
  const timezone = getEventTimezone();
  const dateLocale = getDateLocale(language);

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }
    loadEventData();
    loadPhotoCount();
    window.scrollTo(0, 0);
  }, [eventId, navigate]);

  // Countdown to reveal time when event has ended
  useEffect(() => {
    if (!revealTime) return;
    const interval = setInterval(() => {
      const now = new Date();
      const reveal = new Date(revealTime);
      const distance = reveal.getTime() - now.getTime();
      if (distance < 0) {
        setRevealCountdown(t.camera.photosRevealed);
        clearInterval(interval);
        return;
      }
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setRevealCountdown(
        t.camera.countdownReveal
          .replace("{hours}", String(hours))
          .replace("{minutes}", String(minutes))
          .replace("{seconds}", String(seconds))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [revealTime, t]);

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
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setStartCountdown(
        t.camera.countdownStart
          .replace("{hours}", String(hours))
          .replace("{minutes}", String(minutes))
          .replace("{seconds}", String(seconds))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [uploadStartTime, t]);

  const loadEventData = async () => {
    if (!eventId) return;
    const { data, error } = await supabase
      .from("events")
      .select("reveal_time, upload_start_time, upload_end_time, password_hash, max_photos, custom_image_url, background_image_url, description")
      .eq("id", eventId)
      .single();
    if (data && !error) {
      setRevealTime(data.reveal_time);
      setUploadStartTime(data.upload_start_time || "");
      setUploadEndTime(data.upload_end_time || "");
      setEventPassword(data.password_hash || "");
      setCustomImageUrl(data.custom_image_url || "");
      setBackgroundImageUrl(data.background_image_url || "");
      setEventDescription(data.description || "");
      
      // Check if max photos limit reached
      if (data.max_photos) {
        const { count } = await supabase
          .from("photos")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId);
        
        if (count && count >= data.max_photos) {
          // Treat as event ended
          setUploadEndTime(new Date().toISOString());
        }
      }
    }
  };

  // Helper to format date in local timezone
  const formatLocalDate = (dateStr: string, formatStr: string) => {
    const localDate = getLocalDateInTimezone(dateStr, timezone);
    return format(localDate, formatStr, { locale: dateLocale });
  };

  // Helper to get date label (today/tomorrow/date)
  const getDateLabel = (dateStr: string) => {
    const localDate = getLocalDateInTimezone(dateStr, timezone);
    const now = new Date();
    const nowLocal = getLocalDateInTimezone(now, timezone);
    
    const today = new Date(nowLocal);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const targetDate = new Date(localDate);
    targetDate.setHours(0, 0, 0, 0);
    
    if (targetDate.getTime() === today.getTime()) {
      return t.camera.today;
    } else if (targetDate.getTime() === tomorrow.getTime()) {
      return t.camera.tomorrow;
    } else {
      return `${t.camera.theDay} ${format(localDate, "dd/MM/yyyy", { locale: dateLocale })}`;
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
        setCountdown(t.camera.eventEnded);
        clearInterval(interval);
        return;
      }
      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const dateLabel = getDateLabel(uploadEndTime);
      const formattedTime = formatLocalDate(uploadEndTime, "HH:mm");
      
      setCountdown(
        t.camera.countdownUpload
          .replace("{date}", dateLabel)
          .replace("{time}", formattedTime)
          .replace("{hours}", String(hours))
          .replace("{minutes}", String(minutes))
          .replace("{seconds}", String(seconds))
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [uploadEndTime, t, timezone]);

  const loadPhotoCount = async () => {
    if (!eventId) return;
    const { count } = await supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    setPhotoCount(count || 0);
  };

  const handleTakePhoto = () => {
    // Check if upload period is valid
    const now = new Date();
    const startTime = uploadStartTime ? new Date(uploadStartTime) : null;
    const endTime = uploadEndTime ? new Date(uploadEndTime) : null;
    if (startTime && now < startTime) {
      toast({
        title: t.camera.eventNotStarted,
        description: `${t.camera.eventStartsOn} ${formatLocalDate(uploadStartTime, "dd/MM/yyyy")} ${t.camera.atTime} ${formatLocalDate(uploadStartTime, "HH:mm")}`,
        variant: "destructive",
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
      // Check max photos limit before uploading
      const { data: eventData } = await supabase
        .from("events")
        .select("max_photos")
        .eq("id", eventId)
        .single();

      if (eventData?.max_photos) {
        const { count } = await supabase
          .from("photos")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId);

        if (count && count >= eventData.max_photos) {
          toast({
            title: t.camera.limitReached,
            description: t.camera.limitReachedDesc,
            variant: "destructive",
          });
          return;
        }
      }

      // Compress image to max 1MB
      const compressedFile = await compressImage(file, 1);
      
      const fileName = `${eventId}/${Date.now()}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(fileName, compressedFile);
      if (uploadError) {
        toast({
          title: t.common.error,
          description: t.camera.uploadError,
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
        title: t.camera.uploadSuccess,
        description: t.camera.uploadSuccessDesc,
      });

      // Reload event data to check if max photos reached
      loadEventData();
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: t.common.error,
        description: t.camera.uploadError,
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
    localStorage.removeItem("eventLanguage");
    localStorage.removeItem("eventTimezone");
    navigate("/");
  };

  // Check if event has ended or hasn't started
  const now = new Date();
  const startTime = uploadStartTime ? new Date(uploadStartTime) : null;
  const endTime = uploadEndTime ? new Date(uploadEndTime) : null;
  const reveal = revealTime ? new Date(revealTime) : null;
  const hasNotStarted = startTime && now < startTime;
  const hasEnded = endTime && now > endTime;
  const hasRevealed = reveal && now >= reveal;

  // Capture the magic text based on language
  const captureMagicText = language === "en" ? "Capture the magic!" : language === "it" ? "Cattura la magia!" : "¡Captura la magia!";

  // Photos already revealed - show modal
  if (hasRevealed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Dialog open={true}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl text-center">
                {t.camera.photosRevealed}
              </DialogTitle>
            </DialogHeader>
            {customImageUrl && (
              <div className="flex justify-center py-4">
                <img 
                  src={customImageUrl} 
                  alt="Evento" 
                  className="max-w-[240px] max-h-[100px] object-contain"
                />
              </div>
            )}
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => navigate("/gallery")}
                className="px-8"
              >
                {t.camera.seePhotos}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Event hasn't started yet
  if (hasNotStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {backgroundImageUrl ? (
          <>
            {/* Hero Header with Background Image */}
            <header className="relative w-full">
              <div className="relative h-[50vh] min-h-[320px] max-h-[450px] w-full">
                <img
                  src={backgroundImageUrl}
                  alt={eventName || "Event"}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
                
                <div className="absolute top-4 right-4 z-10">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleLogout}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              <div className="relative -mt-20 px-6 pb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">{eventName}</h1>
                {eventDescription && (
                  <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
                )}
              </div>
            </header>
            
            <div className="px-6 pb-6">
              <div className="flex justify-center pb-6">
                <div className="w-60 h-25 flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                  <img
                    src={customImageUrl || prohibidoIcon}
                    alt="Cámara prohibida"
                    style={{ imageRendering: 'pixelated' }}
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              </div>
              
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                <h2 className="text-2xl font-bold text-foreground">{t.camera.eventNotStarted}</h2>
                <p className="text-muted-foreground text-lg">
                  {t.camera.periodNotStarted}
                </p>
                {uploadStartTime && (
                  <>
                    <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                      <p className="text-sm text-muted-foreground">{t.camera.willStartOn}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatLocalDate(uploadStartTime, "dd MMMM")} {t.camera.atTime} {formatLocalDate(uploadStartTime, "HH:mm")}
                      </p>
                    </div>
                    {startCountdown && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-primary font-semibold">
                          {startCountdown}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-card border-b border-border">
              <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </header>
            
            <div className="pt-16 pb-6 px-6">
              <div className="flex justify-center pt-4 pb-6">
                <div className="w-60 h-25 flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                  <img
                    src={customImageUrl || prohibidoIcon}
                    alt="Cámara prohibida"
                    style={{ imageRendering: 'pixelated' }}
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              </div>
              
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                <h1 className="text-2xl font-bold text-foreground">{t.camera.eventNotStarted}</h1>
                <p className="text-muted-foreground text-lg">
                  {t.camera.periodNotStarted}
                </p>
                {uploadStartTime && (
                  <>
                    <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                      <p className="text-sm text-muted-foreground">{t.camera.willStartOn}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatLocalDate(uploadStartTime, "dd MMMM")} {t.camera.atTime} {formatLocalDate(uploadStartTime, "HH:mm")}
                      </p>
                    </div>
                    {startCountdown && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-primary font-semibold">
                          {startCountdown}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (hasEnded) {
    const revealDateLabel = revealTime ? getDateLabel(revealTime) : "";
    const revealTimeFormatted = revealTime ? formatLocalDate(revealTime, "HH:mm") : "";
    const revealInfoText = language === "en" 
      ? `${revealDateLabel.charAt(0).toUpperCase() + revealDateLabel.slice(1)} at ${revealTimeFormatted} all images will be revealed in this same space 📸✨`
      : language === "it"
      ? `${revealDateLabel.charAt(0).toUpperCase() + revealDateLabel.slice(1)} alle ${revealTimeFormatted} tutte le immagini saranno rivelate in questo stesso spazio 📸✨`
      : `${revealDateLabel.charAt(0).toUpperCase() + revealDateLabel.slice(1)} a las ${revealTimeFormatted} todas las imágenes serán reveladas en este mismo espacio 📸✨`;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {backgroundImageUrl ? (
          <>
            {/* Hero Header with Background Image */}
            <header className="relative w-full">
              <div className="relative h-[50vh] min-h-[320px] max-h-[450px] w-full">
                <img
                  src={backgroundImageUrl}
                  alt={eventName || "Event"}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
                
                <div className="absolute top-4 right-4 z-10">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleLogout}
                    className="bg-background/80 backdrop-blur-sm hover:bg-background"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              <div className="relative -mt-20 px-6 pb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">{eventName}</h1>
                {eventDescription && (
                  <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
                )}
              </div>
            </header>
            
            <div className="px-6 pb-6">
              <div className="flex justify-center pb-6">
                <div className="w-60 h-25 flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                  <img
                    src={customImageUrl || prohibidoIcon}
                    alt="Cámara prohibida"
                    style={{ imageRendering: 'pixelated' }}
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              </div>
              
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                <h2 className="text-2xl font-bold text-foreground">{t.camera.eventEnded}</h2>
                <p className="text-muted-foreground text-lg">
                  {t.camera.eventEndedDesc}
                </p>
                {revealTime && (
                  <>
                    <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                      <p className="text-sm text-muted-foreground">{t.camera.revealingSoon}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatLocalDate(revealTime, "dd MMMM")} {t.camera.atTime} {formatLocalDate(revealTime, "HH:mm")}
                      </p>
                    </div>
                    {revealCountdown && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-primary font-semibold">
                          {revealCountdown}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-card border-b border-border">
              <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </header>
            
            <div className="pt-16 pb-6 px-6">
              <div className="flex justify-center pt-4 pb-6">
                <div className="w-60 h-25 flex items-center justify-center" style={{ imageRendering: 'pixelated' }}>
                  <img
                    src={customImageUrl || prohibidoIcon}
                    alt="Cámara prohibida"
                    style={{ imageRendering: 'pixelated' }}
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              </div>
              
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                <h1 className="text-2xl font-bold text-foreground">{t.camera.eventEnded}</h1>
                <p className="text-muted-foreground text-lg">
                  {t.camera.eventEndedDesc}
                </p>
                {revealTime && (
                  <>
                    <div className="bg-card border border-border rounded-lg p-6 space-y-2">
                      <p className="text-sm text-muted-foreground">{t.camera.revealingSoon}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatLocalDate(revealTime, "dd MMMM")} {t.camera.atTime} {formatLocalDate(revealTime, "HH:mm")}
                      </p>
                    </div>
                    {revealCountdown && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="text-primary font-semibold">
                          {revealCountdown}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Get reveal info text for active event
  const revealDateLabel = revealTime ? getDateLabel(revealTime) : "";
  const revealTimeFormatted = revealTime ? formatLocalDate(revealTime, "HH:mm") : "";
  const revealInfoText = language === "en" 
    ? `${revealDateLabel.charAt(0).toUpperCase() + revealDateLabel.slice(1)} at ${revealTimeFormatted} all images will be revealed in this same space 📸✨`
    : language === "it"
    ? `${revealDateLabel.charAt(0).toUpperCase() + revealDateLabel.slice(1)} alle ${revealTimeFormatted} tutte le immagini saranno rivelate in questo stesso spazio 📸✨`
    : `${revealDateLabel.charAt(0).toUpperCase() + revealDateLabel.slice(1)} a las ${revealTimeFormatted} todas las imágenes serán reveladas en este mismo espacio 📸✨`;

  const uploadButtonText = language === "en" ? "Take photo" : language === "it" ? "Scatta foto" : "Hacer foto";
  const uploadingText = language === "en" ? "Uploading..." : language === "it" ? "Caricamento..." : "Subiendo...";
  const photosUploadedText = language === "en" 
    ? `${photoCount} photos uploaded`
    : language === "it"
    ? `${photoCount} foto caricate`
    : `Ya hay ${photoCount} fotos subidas`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {backgroundImageUrl ? (
        <>
          {/* Hero Header with Background Image */}
          <header className="relative w-full">
            <div className="relative h-[50vh] min-h-[320px] max-h-[450px] w-full">
              <img
                src={backgroundImageUrl}
                alt={eventName || "Event"}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
              
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                {eventPassword && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => setShowShareDialog(true)}
                      className="bg-background/80 backdrop-blur-sm hover:bg-background"
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                    <ShareDialog
                      eventPassword={eventPassword}
                      eventName={eventName || ""}
                      open={showShareDialog}
                      onOpenChange={setShowShareDialog}
                      language={language}
                    />
                  </>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleLogout}
                  className="bg-background/80 backdrop-blur-sm hover:bg-background"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="relative -mt-20 px-6 pb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">{eventName}</h1>
              {eventDescription && (
                <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
              )}
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Image className="w-4 h-4" />
                {photosUploadedText}
              </p>
            </div>
          </header>
          
          <div className="px-6 pb-6">
            <div className="text-center space-y-4 max-w-lg mx-auto animate-fade-in">
              <Button
                onClick={handleTakePhoto}
                disabled={isUploading}
                className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all hover:scale-105 disabled:opacity-50"
              >
                {isUploading ? uploadingText : uploadButtonText}
              </Button>
              <div className="space-y-2">
                {countdown && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-primary font-semibold text-sm">
                      {countdown}
                    </p>
                  </div>
                )}
                <p className="text-muted-foreground leading-relaxed">
                  {revealTime && revealInfoText}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-card border-b border-border">
            <div>
              <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Image className="w-4 h-4" />
                {photosUploadedText}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {eventPassword && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowShareDialog(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="w-5 h-5" />
                  </Button>
                  <ShareDialog
                    eventPassword={eventPassword}
                    eventName={eventName || ""}
                    open={showShareDialog}
                    onOpenChange={setShowShareDialog}
                    language={language}
                  />
                </>
              )}
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

          <div className="pt-16 pb-6 px-6">
            <div className="text-center space-y-4 max-w-lg mx-auto animate-fade-in">
              <Button
                onClick={handleTakePhoto}
                disabled={isUploading}
                className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all hover:scale-105 disabled:opacity-50"
              >
                {isUploading ? uploadingText : uploadButtonText}
              </Button>
              <div className="space-y-2">
                {countdown && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-primary font-semibold text-sm">
                      {countdown}
                    </p>
                  </div>
                )}
                <p className="text-muted-foreground leading-relaxed">
                  {revealTime && revealInfoText}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

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