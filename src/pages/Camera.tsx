import { useState, useRef, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Image, Share2, RefreshCw, Mic, Video, X } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { es, enUS, it } from "date-fns/locale";
import cameraIcon from "@/assets/camera.png";
import prohibidoIcon from "@/assets/prohibido.png";
import { compressImage } from "@/lib/imageCompression";
import ShareDialog from "@/components/ShareDialog";
import { getTranslations, getEventLanguage, getEventTimezone, getLocalDateInTimezone, Language } from "@/lib/translations";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";
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
  const [videoCount, setVideoCount] = useState(0);
  const [audioCount, setAudioCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [revealTime, setRevealTime] = useState<string>("");
  const [uploadStartTime, setUploadStartTime] = useState<string>("");
  const [uploadEndTime, setUploadEndTime] = useState<string>("");
  const [customImageUrl, setCustomImageUrl] = useState<string>("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>("");
  const [eventDescription, setEventDescription] = useState<string>("");
  const [eventFontFamily, setEventFontFamily] = useState<EventFontFamily>("system");
  const [eventFontSize, setEventFontSize] = useState<string>("text-3xl");
  const [showLegalText, setShowLegalText] = useState<boolean>(false);
  const [legalTextType, setLegalTextType] = useState<string>("default");
  const [countdown, setCountdown] = useState<string>("");
  const [revealCountdown, setRevealCountdown] = useState<string>("");
  const [startCountdown, setStartCountdown] = useState<string>("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);
  const [failedUpload, setFailedUpload] = useState<{ file: File } | null>(null);
  const uploadTimestampsRef = useRef<number[]>([]);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allowVideoRecording, setAllowVideoRecording] = useState(false);
  const [maxVideos, setMaxVideos] = useState<number | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(15);
  const [allowAudioRecording, setAllowAudioRecording] = useState(false);
  const [maxAudios, setMaxAudios] = useState<number | null>(null);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(30);
  const [recordingMode, setRecordingMode] = useState<"video" | "audio" | null>(null);
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  const [recordingCountdown, setRecordingCountdown] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingVideoRef = useRef<HTMLVideoElement>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
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
    loadMediaCounts();
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
      .select("reveal_time, upload_start_time, upload_end_time, password_hash, max_photos, custom_image_url, background_image_url, description, font_family, font_size, show_legal_text, legal_text_type, allow_video_recording, max_videos, max_video_duration, allow_audio_recording, max_audios, max_audio_duration")
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
      setEventFontFamily(((data as any).font_family as EventFontFamily) || "system");
      setEventFontSize((data as any).font_size || "text-3xl");
      setShowLegalText((data as any).show_legal_text === true);
      setLegalTextType((data as any).legal_text_type || "default");
      setAllowVideoRecording((data as any).allow_video_recording === true);
      setMaxVideos((data as any).max_videos ?? null);
      setVideoDurationSeconds((data as any).max_video_duration ?? 15);
      setAllowAudioRecording((data as any).allow_audio_recording === true);
      setMaxAudios((data as any).max_audios ?? null);
      setAudioDurationSeconds((data as any).max_audio_duration ?? 30);
      
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

  const loadMediaCounts = async () => {
    if (!eventId) return;
    const [photosRes, videosRes, audiosRes] = await Promise.all([
      supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId),
      supabase
        .from("videos")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId),
      supabase
        .from("audios")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId),
    ]);

    if (!photosRes.error) {
      setPhotoCount(photosRes.count || 0);
    }
    if (!videosRes.error) {
      setVideoCount(videosRes.count || 0);
    }
    if (!audiosRes.error) {
      setAudioCount(audiosRes.count || 0);
    }
  };

  const generateHash = () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const startCooldown = () => {
    setRateLimitCooldown(30);
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      setRateLimitCooldown(prev => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
          cooldownIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const checkRateLimit = (): boolean => {
    const now = Date.now();
    // Keep only timestamps within last 60 seconds
    uploadTimestampsRef.current = uploadTimestampsRef.current.filter(ts => now - ts < 60000);
    if (uploadTimestampsRef.current.length >= 5) {
      toast({
        title: language === "en" ? "Upload limit exceeded" : language === "it" ? "Limite di upload superato" : "Has excedido el número de fotos",
        description: language === "en" 
          ? "You must wait 30 seconds before taking another photo." 
          : language === "it"
          ? "Devi aspettare 30 secondi prima di scattare un'altra foto."
          : "Debes esperar 30 segundos para poder volver a echar una foto.",
        variant: "destructive",
      });
      startCooldown();
      return false;
    }
    return true;
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
      return;
    }
    // Check rate limit
    if (rateLimitCooldown > 0) return;
    if (!checkRateLimit()) return;
    fileInputRef.current?.click();
  };

  const uploadPhoto = async (file: File) => {
    if (!eventId) return;
    setIsUploading(true);
    setFailedUpload(null);
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
      
      const hash = generateHash();
      const fileName = `${eventId}/${hash}_${Date.now()}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(fileName, compressedFile);
      if (uploadError) {
        setFailedUpload({ file });
        toast({
          title: t.common.error,
          description: language === "en"
            ? "The photo could not be uploaded. Please try again."
            : language === "it"
            ? "Non è stato possibile caricare la foto. Riprova."
            : "No se ha podido subir la foto. Inténtalo de nuevo.",
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
        setFailedUpload({ file });
        toast({
          title: t.common.error,
          description: language === "en"
            ? "The photo could not be saved. Please try again."
            : language === "it"
            ? "Non è stato possibile salvare la foto. Riprova."
            : "No se ha podido guardar la foto. Inténtalo de nuevo.",
          variant: "destructive",
        });
        return;
      }
      
      // Track successful upload timestamp for rate limiting
      uploadTimestampsRef.current.push(Date.now());
      
      setPhotoCount((prev) => prev + 1);
      toast({
        title: t.camera.uploadSuccess,
        description: t.camera.uploadSuccessDesc,
      });

      // Reload event data to check if max photos reached
      await loadEventData();
      await loadMediaCounts();
    } catch (error) {
      console.error("Error uploading photo:", error);
      setFailedUpload({ file });
      toast({
        title: t.common.error,
        description: language === "en"
          ? "An unexpected error occurred. Please try again."
          : language === "it"
          ? "Si è verificato un errore imprevisto. Riprova."
          : "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !eventId) return;
    await uploadPhoto(file);
    // Reset input
    if (event.target) {
      event.target.value = "";
    }
  };

  const stopRecordingInterval = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMedia(false);
    stopRecordingInterval();
  };

  const cleanupMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  const resetRecordingState = () => {
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl);
    }
    setRecordingPreviewUrl(null);
    setRecordingBlob(null);
    setRecordingDuration(0);
    setRecordingCountdown(0);
    setRecordingError(null);
    recordedChunksRef.current = [];
  };

  const teardownRecordingControls = () => {
    stopMediaRecorder();
    cleanupMediaStream();
    resetRecordingState();
  };

  const closeRecordingOverlay = () => {
    teardownRecordingControls();
    setRecordingMode(null);
  };

  const handleDiscardRecording = () => {
    resetRecordingState();
  };

  const openRecordingSession = async (mode: "video" | "audio") => {
    if (!eventId) return;
    if (mode === "video") {
      if (!allowVideoRecording) return;
      if (maxVideos !== null && videoCount >= maxVideos) {
        const title = language === "en" ? "Limit reached" : language === "it" ? "Limite raggiunto" : "Límite alcanzado";
        const description =
          language === "en"
            ? "You've uploaded the maximum number of videos."
            : language === "it"
            ? "Hai raggiunto il numero massimo di video."
            : "Ya alcanzaste el número máximo de vídeos.";
        toast({ title, description, variant: "destructive" });
        return;
      }
    }
    if (mode === "audio") {
      if (!allowAudioRecording) return;
      if (maxAudios !== null && audioCount >= maxAudios) {
        const title = language === "en" ? "Limit reached" : language === "it" ? "Limite raggiunto" : "Límite alcanzado";
        const description =
          language === "en"
            ? "You've uploaded the maximum number of audio notes."
            : language === "it"
            ? "Hai raggiunto il numero massimo di note audio."
            : "Ya alcanzaste el número máximo de notas de audio.";
        toast({ title, description, variant: "destructive" });
        return;
      }
    }

    try {
      teardownRecordingControls();
      const constraints =
        mode === "video"
          ? { video: { facingMode: "environment" }, audio: true }
          : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (mode === "video" && recordingVideoRef.current) {
        recordingVideoRef.current.srcObject = stream;
      }
      setRecordingMode(mode);
      setRecordingCountdown(mode === "video" ? videoDurationSeconds : audioDurationSeconds);
      setRecordingDuration(0);
      setRecordingError(null);
    } catch (error) {
      console.error("Error accessing media:", error);
      const description =
        language === "en"
          ? "We couldn't access your camera or microphone."
          : language === "it"
          ? "Non possiamo accedere alla fotocamera o al microfono."
          : "No pudimos acceder a la cámara o al micrófono.";
      toast({
        title: t("form.errorTitle"),
        description,
        variant: "destructive",
      });
    }
  };

  const startMediaRecording = () => {
    if (!recordingMode || !mediaStreamRef.current) return;
    if (isRecordingMedia) {
      stopMediaRecorder();
      return;
    }

    try {
      const preferredType =
        recordingMode === "video" ? "video/webm;codecs=vp8,opus" : "audio/webm;codecs=opus";
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported(preferredType)) {
        options.mimeType = preferredType;
      }
      const recorder = new MediaRecorder(mediaStreamRef.current, options);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - recordingStartRef.current) / 1000)
        );
        setRecordingDuration(durationSeconds);
        const blob = new Blob(recordedChunksRef.current, {
          type: options.mimeType || (recordingMode === "video" ? "video/webm" : "audio/webm"),
        });
        setRecordingBlob(blob);
        if (recordingPreviewUrl) {
          URL.revokeObjectURL(recordingPreviewUrl);
        }
        const previewUrl = URL.createObjectURL(blob);
        setRecordingPreviewUrl(previewUrl);
        setIsRecordingMedia(false);
        stopRecordingInterval();
        setRecordingCountdown(0);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      setIsRecordingMedia(true);
      stopRecordingInterval();
      const initialCountdown = recordingMode === "video" ? videoDurationSeconds : audioDurationSeconds;
      setRecordingCountdown(initialCountdown);
      countdownIntervalRef.current = window.setInterval(() => {
        setRecordingCountdown((prev) => {
          if (prev <= 1) {
            stopMediaRecorder();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Recording failed:", error);
      setRecordingError(
        language === "en"
          ? "Recording not supported"
          : language === "it"
          ? "Registrazione non supportata"
          : "La grabación no está disponible"
      );
    }
  };

  const handleUseRecording = async () => {
    if (!recordingBlob || !recordingMode) return;
    const durationSeconds =
      recordingDuration || (recordingMode === "video" ? videoDurationSeconds : audioDurationSeconds);
    await uploadMediaFile(recordingBlob, recordingMode, durationSeconds);
    closeRecordingOverlay();
  };

  const uploadMediaFile = async (blob: Blob, mode: "video" | "audio", duration: number) => {
    if (!eventId) return;
    setIsUploadingMedia(true);
    try {
      const bucket = mode === "video" ? "event-videos" : "event-audio";
      const table = mode === "video" ? "videos" : "audios";
      const hash = generateHash();
      const extension = mode === "video" ? "webm" : "webm";
      const fileName = `${eventId}/${hash}_${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, blob);
      if (uploadError) throw uploadError;
      const { error: dbError } = await supabase.from(table).insert({
        event_id: eventId,
        [mode === "video" ? "video_url" : "audio_url"]: fileName,
        duration_seconds: Math.max(1, Math.round(duration)),
      });
      if (dbError) throw dbError;

      const description =
        language === "en"
          ? mode === "video"
            ? "Your video was saved and will appear when the gallery is revealed."
            : "Your audio note was saved and will appear when the gallery is revealed."
          : language === "it"
          ? mode === "video"
            ? "Il tuo video è stato salvato e apparirà quando la galleria verrà rivelata."
            : "La tua nota audio è stata salvata e apparirà quando la galleria verrà rivelata."
          : mode === "video"
          ? "Tu vídeo se guardó y aparecerá cuando se revele la galería."
          : "Tu nota de audio se guardó y aparecerá cuando se revele la galería.";

      toast({
        title: t.camera.uploadSuccess,
        description,
      });
      await loadMediaCounts();
    } catch (error) {
      console.error("Error uploading media:", error);
      toast({
        title: t.common.error,
        description:
          language === "en"
            ? "We couldn't upload the recording. Please try again."
            : language === "it"
            ? "Non è stato possibile caricare la registrazione. Riprova."
            : "No se pudo subir la grabación. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleRetryUpload = () => {
    if (failedUpload) {
      uploadPhoto(failedUpload.file);
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

  // Photos already revealed - go straight to gallery
  if (hasRevealed) {
    return <Navigate to="/gallery" replace />;
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
                  className="absolute inset-0 w-full h-full object-cover object-top"
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
                <h1 
                  className={`${eventFontSize} md:text-4xl font-bold tracking-tight text-foreground mb-2`}
                  style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
                >
                  {eventName}
                </h1>
                {eventDescription && (
                  <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
                )}
              </div>
            </header>
            
            <div className="flex-1 px-6 pb-6 flex flex-col">
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                {/* Crossed camera icon - always visible, above title */}
                <div>
                  <img
                    src={prohibidoIcon}
                    alt="Cámara prohibida"
                    className="max-w-[180px] max-h-[80px] object-contain mx-auto"
                  />
                </div>
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
              
              {/* Custom image at bottom - only if set */}
              {customImageUrl && (
                <div className="flex-1 flex items-end justify-center pt-6">
                  <img
                    src={customImageUrl}
                    alt="Imagen personalizada"
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              )}
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
            
            <div className="flex-1 pt-16 pb-6 px-6 flex flex-col">
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                {/* Crossed camera icon - always visible, above title */}
                <div>
                  <img
                    src={prohibidoIcon}
                    alt="Cámara prohibida"
                    className="max-w-[180px] max-h-[80px] object-contain mx-auto"
                  />
                </div>
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
              
              {/* Custom image at bottom - only if set */}
              {customImageUrl && (
                <div className="flex-1 flex items-end justify-center pt-6">
                  <img
                    src={customImageUrl}
                    alt="Imagen personalizada"
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              )}
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
                  className="absolute inset-0 w-full h-full object-cover object-top"
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
                <h1 
                  className={`${eventFontSize} md:text-4xl font-bold tracking-tight text-foreground mb-2`}
                  style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
                >
                  {eventName}
                </h1>
                {eventDescription && (
                  <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
                )}
              </div>
            </header>
            
            <div className="flex-1 px-6 pb-6 flex flex-col">
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                {/* Crossed camera icon - always visible, above title */}
                <div>
                  <img
                    src={prohibidoIcon}
                    alt="Cámara prohibida"
                    className="max-w-[180px] max-h-[80px] object-contain mx-auto"
                  />
                </div>
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
              
              {/* Custom image at bottom - only if set */}
              {customImageUrl && (
                <div className="flex-1 flex items-end justify-center pt-6">
                  <img
                    src={customImageUrl}
                    alt="Imagen personalizada"
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-card border-b border-border">
              <h1 
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
              >
                {eventName}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </header>
            
            <div className="flex-1 pt-16 pb-6 px-6 flex flex-col">
              <div className="text-center space-y-4 max-w-md mx-auto animate-fade-in">
                {/* Crossed camera icon - always visible, above title */}
                <div>
                  <img
                    src={prohibidoIcon}
                    alt="Cámara prohibida"
                    className="max-w-[180px] max-h-[80px] object-contain mx-auto"
                  />
                </div>
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
              
              {/* Custom image at bottom - only if set */}
              {customImageUrl && (
                <div className="flex-1 flex items-end justify-center pt-6">
                  <img
                    src={customImageUrl}
                    alt="Imagen personalizada"
                    className="max-w-[240px] max-h-[100px] object-contain"
                  />
                </div>
              )}
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
  const mediaCountsText = language === "en"
    ? `📷 ${photoCount} photos / 📹 ${videoCount} videos / 🔈 ${audioCount} audios`
    : language === "it"
    ? `📷 ${photoCount} foto / 📹 ${videoCount} video / 🔈 ${audioCount} audio`
    : `📷 ${photoCount} fotos / 📹 ${videoCount} vídeos / 🔈 ${audioCount} audios`;
  const cooldownText = language === "en" ? `Wait ${rateLimitCooldown}s` : language === "it" ? `Attendi ${rateLimitCooldown}s` : `Espera ${rateLimitCooldown}s`;
  const retryText = language === "en" ? "Retry" : language === "it" ? "Riprova" : "Reintentar";
  const isButtonDisabled = isUploading || rateLimitCooldown > 0;
  const buttonLabel = rateLimitCooldown > 0 ? cooldownText : isUploading ? uploadingText : uploadButtonText;
  const videoLimitReached = allowVideoRecording && maxVideos !== null && videoCount >= maxVideos;
  const audioLimitReached = allowAudioRecording && maxAudios !== null && audioCount >= maxAudios;
  const mediaButtonDisabled = isRecordingMedia || isUploadingMedia;
  const recordVideoText = language === "en" ? "Record video" : language === "it" ? "Registra video" : "Grabar vídeo";
  const recordAudioText = language === "en" ? "Record audio" : language === "it" ? "Registra audio" : "Grabar audio";

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
                className="absolute inset-0 w-full h-full object-cover object-top"
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
                      eventId={eventId}
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
              <h1 
                className={`${eventFontSize} md:text-4xl font-bold tracking-tight text-foreground mb-2`}
                style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
              >
                {eventName}
              </h1>
              {eventDescription && (
                <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto mb-2 whitespace-pre-line">{eventDescription}</p>
              )}
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Image className="w-4 h-4" />
                {photosUploadedText}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mediaCountsText}
              </p>
            </div>
          </header>
          
          <div className="flex-1 px-6 pb-6 flex flex-col">
            <div className="text-center space-y-4 max-w-lg mx-auto animate-fade-in">
              <Button
                onClick={handleTakePhoto}
                disabled={isButtonDisabled}
                className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all hover:scale-105 disabled:opacity-50"
              >
                {buttonLabel}
              </Button>
              {failedUpload && !isUploading && (
                <Button
                  onClick={handleRetryUpload}
                  variant="outline"
                  className="h-12 px-6 text-base rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {retryText}
                </Button>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {allowVideoRecording && (
                  <Button
                    variant="outline"
                    className="h-12 px-6 text-base rounded-xl flex items-center justify-center gap-2"
                    onClick={() => openRecordingSession("video")}
                    disabled={mediaButtonDisabled || videoLimitReached}
                  >
                    <Video className="w-4 h-4" />
                    <span>{recordVideoText}</span>
                  </Button>
                )}
                {allowAudioRecording && (
                  <Button
                    variant="outline"
                    className="h-12 px-6 text-base rounded-xl flex items-center justify-center gap-2"
                    onClick={() => openRecordingSession("audio")}
                    disabled={mediaButtonDisabled || audioLimitReached}
                  >
                    <Mic className="w-4 h-4" />
                    <span>{recordAudioText}</span>
                  </Button>
                )}
              </div>
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
            
            {/* Custom image at bottom - only if set */}
            {customImageUrl && (
              <div className="flex items-end justify-center pt-6">
                <img
                  src={customImageUrl}
                  alt="Imagen personalizada"
                  className="max-w-[240px] max-h-[100px] object-contain"
                />
              </div>
            )}
            
            {/* Legal text - only if enabled */}
            {showLegalText && (
              <div className="flex-1 flex items-end justify-center pt-4 pb-2">
                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  Al hacer la foto aceptas los{" "}
                  <Link to={legalTextType === "custom" ? `/terms?eventId=${eventId}` : "/terms"} className="underline hover:text-foreground">
                    Términos y Condiciones
                  </Link>{" "}
                  y la{" "}
                  <Link to={legalTextType === "custom" ? `/privacy?eventId=${eventId}` : "/privacy"} className="underline hover:text-foreground">
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-card border-b border-border">
            <div>
              <h1 
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: getEventFontFamily(eventFontFamily) }}
              >
                {eventName}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Image className="w-4 h-4" />
                {photosUploadedText}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mediaCountsText}
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
                    eventId={eventId}
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

          <div className="flex-1 pt-16 pb-6 px-6 flex flex-col">
            <div className="text-center space-y-4 max-w-lg mx-auto animate-fade-in">
              <Button
                onClick={handleTakePhoto}
                disabled={isButtonDisabled}
                className="h-16 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all hover:scale-105 disabled:opacity-50"
              >
                {buttonLabel}
              </Button>
              {failedUpload && !isUploading && (
                <Button
                  onClick={handleRetryUpload}
                  variant="outline"
                  className="h-12 px-6 text-base rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {retryText}
                </Button>
              )}
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
            
            {/* Custom image at bottom - only if set */}
            {customImageUrl && (
              <div className="flex items-end justify-center pt-6">
                <img
                  src={customImageUrl}
                  alt="Imagen personalizada"
                  className="max-w-[240px] max-h-[100px] object-contain"
                />
              </div>
            )}
            
            {/* Legal text - only if enabled */}
            {showLegalText && (
              <div className="flex-1 flex items-end justify-center pt-4 pb-2">
                <p className="text-xs text-muted-foreground text-center max-w-sm">
                  Al hacer la foto aceptas los{" "}
                  <Link to={legalTextType === "custom" ? `/terms?eventId=${eventId}` : "/terms"} className="underline hover:text-foreground">
                    Términos y Condiciones
                  </Link>{" "}
                  y la{" "}
                  <Link to={legalTextType === "custom" ? `/privacy?eventId=${eventId}` : "/privacy"} className="underline hover:text-foreground">
                    Política de Privacidad
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {recordingMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {recordingMode === "video" ? recordVideoText : recordAudioText}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === "en"
                    ? `Max ${recordingMode === "video" ? videoDurationSeconds : audioDurationSeconds}s`
                    : language === "it"
                    ? `Max ${recordingMode === "video" ? videoDurationSeconds : audioDurationSeconds}s`
                    : `Máx. ${recordingMode === "video" ? videoDurationSeconds : audioDurationSeconds}s`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeRecordingOverlay}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {recordingBlob ? (
              <div className="space-y-4">
                {recordingMode === "video" ? (
                  <video
                    src={recordingPreviewUrl || ""}
                    controls
                    className="w-full rounded-2xl bg-black"
                  />
                ) : (
                  <div className="space-y-2 text-center">
                    <audio
                      src={recordingPreviewUrl || ""}
                      controls
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === "en"
                        ? `Duration: ${recordingDuration}s`
                        : language === "it"
                        ? `Durata: ${recordingDuration}s`
                        : `Duración: ${recordingDuration}s`}
                    </p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={handleUseRecording}
                    disabled={isUploadingMedia}
                  >
                    {language === "en" ? "Use" : language === "it" ? "Usa" : "Usar"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleDiscardRecording}
                  >
                    {language === "en" ? "Discard" : language === "it" ? "Scarta" : "Descartar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex flex-col items-center">
                {recordingMode === "video" ? (
                  <video
                    ref={recordingVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full rounded-2xl bg-black aspect-video"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Mic className="w-10 h-10 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center">
                      {language === "en"
                        ? "Use the mic button to start recording."
                        : language === "it"
                        ? "Usa il pulsante per iniziare la registrazione."
                        : "Pulsa el botón para comenzar a grabar."}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={startMediaRecording}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-destructive bg-destructive/80 text-white shadow-lg transition hover:scale-105"
                >
                  <span className="text-lg font-semibold">
                    {isRecordingMedia
                      ? language === "en"
                        ? "Stop"
                        : language === "it"
                        ? "Stop"
                        : "Parar"
                      : language === "en"
                      ? "Rec"
                      : language === "it"
                      ? "Rec"
                      : "Rec"}
                  </span>
                </button>

                <p className="text-xs text-muted-foreground">
                  {recordingCountdown > 0
                    ? language === "en"
                      ? `Time left: ${recordingCountdown}s`
                      : language === "it"
                      ? `Tempo rimasto: ${recordingCountdown}s`
                      : `Tiempo restante: ${recordingCountdown}s`
                    : language === "en"
                    ? "Ready to record"
                    : language === "it"
                    ? "Pronto per registrare"
                    : "Listo para grabar"}
                </p>
                {recordingError && (
                  <p className="text-xs text-destructive">{recordingError}</p>
                )}
              </div>
            )}
          </div>
        </div>
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
