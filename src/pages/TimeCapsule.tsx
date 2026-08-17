import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabasePublic } from "@/integrations/supabase/publicClient";
import {
  TIME_CAPSULE_DEFAULT_DESCRIPTION,
  TIME_CAPSULE_MAX_VIDEO_SECONDS,
  TIME_CAPSULE_DEFAULT_LOGO_URL,
  addYears,
  getTimeCapsuleSettings,
  isTimeCapsuleEvent,
} from "@/lib/timeCapsule";
import { getFontById, loadGoogleFont, type EventFontFamily } from "@/lib/eventFonts";
import { Heart, Loader2, RotateCcw, Send, Square, SwitchCamera, Video } from "lucide-react";

type Step = "intro" | "message" | "name" | "record" | "done";

interface CapsuleEvent {
  id: string;
  name: string;
  description: string | null;
  custom_image_url: string | null;
  font_family: string | null;
  upload_start_time: string | null;
  upload_end_time: string | null;
  timezone: string | null;
  plan_id: string | null;
  type: string | null;
  limits_json: unknown;
  max_videos: number | null;
}

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return null;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
};

const getExtension = (mimeType: string | null | undefined) => {
  const mime = (mimeType || "").toLowerCase();
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  return "webm";
};

const generateHash = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => n.toString(16).padStart(2, "0")).join("");

const formatLongDate = (iso: string | null, timeZone: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);
};

const formatLongDateTime = (iso: string | null, timeZone: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
};

const formatSeconds = (value: number) => {
  const safe = Math.max(0, Math.floor(value));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

const createVideoThumbnail = (url: string) =>
  new Promise<string | null>((resolve) => {
    const preview = document.createElement("video");
    preview.muted = true;
    preview.playsInline = true;
    preview.preload = "auto";
    const finish = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = preview.videoWidth || 720;
        canvas.height = preview.videoHeight || 1280;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.drawImage(preview, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve(null);
      }
    };
    preview.onloadeddata = () => {
      const target = Number.isFinite(preview.duration) && preview.duration > 0
        ? Math.min(0.3, preview.duration / 2)
        : 0;
      if (target > 0) {
        preview.onseeked = finish;
        preview.currentTime = target;
      } else {
        finish();
      }
    };
    preview.onerror = () => resolve(null);
    preview.src = url;
  });

const TimeCapsule = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<CapsuleEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("intro");
  const [guestName, setGuestName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordedThumbnail, setRecordedThumbnail] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!eventId) {
        setLoadError("Enlace no válido.");
        setIsLoading(false);
        return;
      }
      const { data, error } = await supabasePublic
        .from("events")
        .select(
          "id, name, description, custom_image_url, font_family, upload_start_time, upload_end_time, timezone, plan_id, type, limits_json, max_videos",
        )
        .eq("id", eventId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data || !isTimeCapsuleEvent(data)) {
        setLoadError("No hemos encontrado esta cápsula del tiempo.");
        setIsLoading(false);
        return;
      }
      setEvent(data as CapsuleEvent);
      setIsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraReady(false);
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      stopStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    },
    [clearTimers, stopStream, recordedUrl],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const capsuleSettings = useMemo(
    () => getTimeCapsuleSettings((event?.limits_json ?? null) as never),
    [event?.limits_json],
  );
  const timeZone = event?.timezone || "Europe/Madrid";
  const informationalOpenDate = useMemo(() => {
    if (!event?.upload_start_time) return null;
    const weddingStart = new Date(event.upload_start_time);
    if (Number.isNaN(weddingStart.getTime())) return null;
    return addYears(weddingStart, capsuleSettings.years);
  }, [capsuleSettings.years, event?.upload_start_time]);
  const openDateLabel = formatLongDate(informationalOpenDate?.toISOString() ?? null, timeZone);
  const titleFont = useMemo(
    () => getFontById((event?.font_family as EventFontFamily) || "system"),
    [event?.font_family],
  );

  useEffect(() => {
    loadGoogleFont(titleFont);
  }, [titleFont]);

  const startsAt = event?.upload_start_time ? new Date(event.upload_start_time).getTime() : null;
  const endsAt = event?.upload_end_time ? new Date(event.upload_end_time).getTime() : null;
  const notOpenYet = startsAt !== null && now < startsAt;
  const closed = endsAt !== null && now > endsAt;

  const capsuleLogo = useMemo(() => {
    if (capsuleSettings.logoMode === "none") return null;
    const logoUrl = capsuleSettings.logoMode === "custom" && capsuleSettings.logoUrl
      ? capsuleSettings.logoUrl
      : TIME_CAPSULE_DEFAULT_LOGO_URL;
    const logo = (
      <div className="mx-auto flex w-fit items-center justify-center rounded-md bg-white px-4 py-2 shadow-lg">
        <img
          src={logoUrl}
          alt={capsuleSettings.logoMode === "custom" ? "Logo del evento" : "Revelao"}
          className="h-7 max-w-[180px] object-contain"
        />
      </div>
    );
    return capsuleSettings.logoLink ? (
      <a
        href={capsuleSettings.logoLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto block w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {logo}
      </a>
    ) : logo;
  }, [capsuleSettings.logoLink, capsuleSettings.logoMode, capsuleSettings.logoUrl]);

  const startCamera = async (cameraFacing: "user" | "environment" = facingMode) => {
    setRecordError(null);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setIsCameraReady(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setIsCameraReady(false);
      setRecordError("Necesitamos permiso para usar la cámara y el micrófono.");
    }
  };

  const switchCamera = async () => {
    if (isRecording) return;
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    await startCamera(nextFacing);
  };

  useEffect(() => {
    if (step !== "record" || recordedBlob) return;
    startCamera("user");
    return () => {
      clearTimers();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, recordedBlob]);

  const stopRecording = () => {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  useEffect(() => {
    if (!notOpenYet && !closed) return;
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    stopStream();
    setIsRecording(false);
  }, [clearTimers, closed, notOpenYet, stopStream]);

  const startRecording = () => {
    if (!streamRef.current) return;
    setRecordError(null);
    chunksRef.current = [];
    const preferred = getSupportedMimeType();
    const options: MediaRecorderOptions = {};
    if (preferred) options.mimeType = preferred;

    try {
      const recorder = new MediaRecorder(streamRef.current, options);
      mimeTypeRef.current = recorder.mimeType || preferred;
      recorder.ondataavailable = (chunkEvent) => {
        if (chunkEvent.data && chunkEvent.data.size > 0) chunksRef.current.push(chunkEvent.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || "video/webm" });
        setRecordedBlob(blob);
        setRecordedUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          const nextUrl = URL.createObjectURL(blob);
          void createVideoThumbnail(nextUrl).then(setRecordedThumbnail);
          return nextUrl;
        });
        stopStream();
      };
      recorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setElapsed(0);
      setRecordedDuration(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          setRecordedDuration(next);
          return next;
        });
      }, 1000);
      autoStopRef.current = setTimeout(stopRecording, TIME_CAPSULE_MAX_VIDEO_SECONDS * 1000);
    } catch {
      setRecordError("Tu dispositivo no permite grabar vídeo desde el navegador.");
    }
  };

  const resetRecording = async () => {
    clearTimers();
    setRecordedBlob(null);
    setRecordedThumbnail(null);
    setRecordedUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setRecordedDuration(0);
    setElapsed(0);
    await startCamera(facingMode);
  };

  const sendVideo = async () => {
    if (!event || !recordedBlob) return;
    const sendTime = Date.now();
    if ((startsAt !== null && sendTime < startsAt) || (endsAt !== null && sendTime > endsAt)) {
      setNow(sendTime);
      setRecordError("La cápsula del tiempo está cerrada y ya no admite vídeos.");
      return;
    }
    setIsSending(true);
    setRecordError(null);
    try {
      const extension = getExtension(mimeTypeRef.current);
      const fileName = `${event.id}/${generateHash()}_${Date.now()}.${extension}`;
      const { error: uploadError } = await supabasePublic.storage
        .from("event-videos")
        .upload(fileName, recordedBlob, { contentType: mimeTypeRef.current || undefined });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabasePublic.from("videos").insert({
        event_id: event.id,
        video_url: fileName,
        duration_seconds: Math.max(1, Math.min(TIME_CAPSULE_MAX_VIDEO_SECONDS, recordedDuration || 1)),
        metadata: { guest_name: guestName.trim(), source: "time_capsule" },
      });
      if (insertError) {
        await supabasePublic.storage.from("event-videos").remove([fileName]);
        throw insertError;
      }

      stopStream();
      setStep("done");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error);
      setRecordError(
        message.includes("TIME_CAPSULE_MESSAGE_LIMIT_REACHED")
          ? "Esta cápsula ya ha alcanzado el máximo de mensajes de su plan."
          : "No hemos podido enviar tu vídeo. Inténtalo de nuevo.",
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="capsule-shell min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin opacity-60" />
      </div>
    );
  }

  if (loadError || !event) {
    return (
      <div className="capsule-shell min-h-[100dvh] flex items-center justify-center p-6">
        <div className="capsule-card p-8 text-center max-w-sm">
          <Heart className="w-8 h-8 mx-auto mb-4 opacity-50" />
          <p className="text-xl">{loadError}</p>
        </div>
      </div>
    );
  }

  const backgroundStyle: React.CSSProperties = {
    backgroundImage: event.custom_image_url
      ? `linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.82) 100%), url("${event.custom_image_url.replace(/"/g, "%22")}")`
      : "linear-gradient(160deg, #252525 0%, #151515 52%, #050505 100%)",
    backgroundPosition: "center",
    backgroundSize: "cover",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  };

  const header = (
    <header className="space-y-3 text-center text-white">
      <h1
        className="text-4xl font-bold tracking-tight sm:text-5xl"
        style={{ fontFamily: titleFont.fontFamily }}
      >
        {event.name}
      </h1>
      <div className="mx-auto h-1 w-12 rounded-full bg-[#f06a5f]" />
    </header>
  );

  const wrap = (children: React.ReactNode) => (
    <main
      className="relative flex min-h-[100dvh] items-center justify-center bg-black px-5 py-10 text-white"
      style={backgroundStyle}
    >
      <div className="w-full max-w-md space-y-8">
        {header}
        <section className="space-y-6 rounded-3xl border border-white/20 bg-black/35 p-7 shadow-2xl backdrop-blur-md">
          {children}
        </section>
        {capsuleLogo}
      </div>
    </main>
  );

  if (notOpenYet) {
    return wrap(
      <div className="text-center space-y-3">
        <h2 className="text-2xl">La cápsula del tiempo está cerrada</h2>
        <p className="text-lg leading-relaxed opacity-80">
          Podrás grabar tu mensaje a partir del {formatLongDateTime(event.upload_start_time, timeZone)}.
        </p>
      </div>,
    );
  }

  if (closed) {
    return wrap(
      <div className="text-center space-y-3">
        <h2 className="text-2xl">La cápsula del tiempo está cerrada</h2>
        <p className="text-lg leading-relaxed opacity-80">
          El plazo para grabar mensajes terminó el {formatLongDateTime(event.upload_end_time, timeZone)}.
        </p>
      </div>,
    );
  }

  if (step === "intro") {
    return (
      <main
        className="relative h-[100dvh] overflow-hidden bg-black px-5 text-white"
        style={backgroundStyle}
      >
        <div
          className="mx-auto flex h-full w-full max-w-md flex-col"
          style={{
            paddingTop: "max(1.75rem, env(safe-area-inset-top))",
            paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          }}
        >
          <header className="shrink-0 space-y-3 text-center">
            <h1
              className="text-[clamp(2.25rem,11vw,3.5rem)] font-bold leading-[1.05] tracking-tight"
              style={{ fontFamily: titleFont.fontFamily }}
            >
              {event.name}
            </h1>
            <div className="mx-auto h-1 w-12 rounded-full bg-[#f06a5f]" />
          </header>

          <div className="mt-auto shrink-0 space-y-4">
            <button
              type="button"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#f06a5f] px-6 font-semibold text-white shadow-lg transition hover:bg-[#df5d53]"
              onClick={() => setStep("message")}
            >
              <Heart className="h-4 w-4" /> Empezar
            </button>
            {capsuleLogo}
          </div>
        </div>
      </main>
    );
  }

  if (step === "message") {
    return wrap(
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Un mensaje para el futuro</h2>
        <p className="text-lg leading-relaxed text-white/85">
          {event.description?.trim() || TIME_CAPSULE_DEFAULT_DESCRIPTION}
        </p>
        <div className="h-px bg-white/20" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          Se abrirá en {capsuleSettings.years} años · {openDateLabel}
        </p>
        <button type="button" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f06a5f] px-6 font-semibold text-white transition hover:bg-[#df5d53]" onClick={() => setStep("name")}>
          Siguiente
        </button>
      </div>,
    );
  }

  if (step === "name") {
    return wrap(
      <form
        className="space-y-7 text-center"
        onSubmit={(formEvent) => {
          formEvent.preventDefault();
          if (guestName.trim().length < 2) return;
          setStep("record");
        }}
      >
        <h2 className="text-2xl">¿Cómo te llamas?</h2>
        <p className="text-base opacity-75">Así los novios sabrán de quién es cada mensaje.</p>
        <input
          className="h-12 w-full rounded-full border border-white/30 bg-white/95 px-5 text-center text-base text-foreground outline-none transition focus:border-[#f06a5f] focus:ring-2 focus:ring-[#f06a5f]/30"
          value={guestName}
          onChange={(inputEvent) => setGuestName(inputEvent.target.value)}
          placeholder="Tu nombre"
          maxLength={60}
          autoFocus
        />
        <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#f06a5f] px-6 font-semibold text-white transition hover:bg-[#df5d53] disabled:cursor-not-allowed disabled:opacity-50" disabled={guestName.trim().length < 2}>
          Siguiente
        </button>
      </form>,
    );
  }

  if (step === "done") {
    return wrap(
      <div className="text-center space-y-4">
        <Heart className="w-9 h-9 mx-auto" style={{ color: "hsl(344 38% 62%)" }} />
        <h2 className="text-2xl">Gracias, {guestName.trim().split(" ")[0]}</h2>
        <p className="text-lg leading-relaxed opacity-85">
          Tu mensaje ya está dentro de la cápsula. Se abrirá el {openDateLabel}.
        </p>
      </div>,
    );
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      {recordedUrl ? (
        <video
          src={recordedUrl}
          poster={recordedThumbnail || undefined}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-x-0 top-0 h-[calc(100%-7rem)] w-full bg-black object-contain"
        />
      ) : (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-lg font-bold leading-tight">{recordedBlob ? "Revisa tu vídeo" : "Graba tu mensaje"}</p>
          <p className="mt-1 text-sm text-white/70">{guestName.trim()} · máximo {TIME_CAPSULE_MAX_VIDEO_SECONDS}s</p>
        </div>
        {!recordedBlob ? (
          <button
            type="button"
            onClick={() => void switchCamera()}
            disabled={isRecording}
            aria-label="Cambiar cámara"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55 disabled:opacity-40"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {isRecording ? (
        <div className="absolute left-1/2 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold tracking-widest backdrop-blur-md">
          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          {formatSeconds(TIME_CAPSULE_MAX_VIDEO_SECONDS - elapsed)}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
        {recordError ? (
          <p className="mx-auto mb-4 max-w-md rounded-2xl bg-black/65 px-4 py-3 text-center text-sm text-white backdrop-blur-md">
            {recordError}
          </p>
        ) : null}

        {recordedBlob ? (
          <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/30 bg-black/45 px-4 font-semibold text-white backdrop-blur-md transition hover:bg-black/65"
              onClick={resetRecording}
              disabled={isSending}
            >
              <RotateCcw className="h-4 w-4" /> Volver a grabar
            </button>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f06a5f] px-4 font-semibold text-white transition hover:bg-[#df5d53] disabled:opacity-50"
              onClick={sendVideo}
              disabled={isSending}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? "Enviando" : "Enviar"}
            </button>
          </div>
        ) : isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Terminar grabación"
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[#f06a5f] shadow-2xl"
          >
            <Square className="h-7 w-7 fill-current" />
          </button>
        ) : (
          <div className="text-center">
            <button
              type="button"
              onClick={startRecording}
              disabled={!isCameraReady}
              aria-label="Empezar a grabar"
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[#f06a5f] shadow-2xl transition active:scale-95 disabled:opacity-50"
            >
              <Video className="h-7 w-7" />
            </button>
            <p className="mt-3 text-sm font-medium text-white/80">Pulsa para empezar</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default TimeCapsule;
