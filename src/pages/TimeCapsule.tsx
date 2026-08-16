import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabasePublic } from "@/integrations/supabase/publicClient";
import {
  TIME_CAPSULE_MAX_VIDEO_SECONDS,
  addYears,
  getTimeCapsuleSettings,
  isTimeCapsuleEvent,
} from "@/lib/timeCapsule";
import { Heart, Loader2, RotateCcw, Send, Square, Video } from "lucide-react";

type Step = "intro" | "name" | "record" | "done";

interface CapsuleEvent {
  id: string;
  name: string;
  description: string | null;
  custom_image_url: string | null;
  upload_start_time: string | null;
  upload_end_time: string | null;
  timezone: string | null;
  plan_id: string | null;
  type: string | null;
  limits_json: unknown;
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
          "id, name, description, custom_image_url, upload_start_time, upload_end_time, timezone, plan_id, type, limits_json",
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

  const startsAt = event?.upload_start_time ? new Date(event.upload_start_time).getTime() : null;
  const endsAt = event?.upload_end_time ? new Date(event.upload_end_time).getTime() : null;
  const notOpenYet = startsAt !== null && now < startsAt;
  const closed = endsAt !== null && now > endsAt;

  const startCamera = async () => {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch {
      setRecordError("Necesitamos permiso para usar la cámara y el micrófono.");
    }
  };

  useEffect(() => {
    if (step !== "record" || recordedBlob) return;
    startCamera();
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
          return URL.createObjectURL(blob);
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
    setRecordedUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setRecordedDuration(0);
    setElapsed(0);
    await startCamera();
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
      if (insertError) throw insertError;

      stopStream();
      setStep("done");
    } catch {
      setRecordError("No hemos podido enviar tu vídeo. Inténtalo de nuevo.");
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

  const header = (
    <header className="text-center space-y-3">
      {event.custom_image_url ? (
        <img
          src={event.custom_image_url}
          alt={event.name}
          className="mx-auto max-h-40 w-auto rounded-2xl object-cover shadow-lg"
          loading="lazy"
        />
      ) : null}
      <p className="capsule-eyebrow">Cápsula del tiempo</p>
      <h1 className="capsule-script text-4xl sm:text-5xl">{event.name}</h1>
      <div className="capsule-rule mx-auto w-32" />
    </header>
  );

  const wrap = (children: React.ReactNode) => (
    <main className="capsule-shell min-h-[100dvh] px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-md space-y-8">
        {header}
        <section className="capsule-card p-7 space-y-6">{children}</section>
        <p className="text-center text-xs opacity-50">Revelao.cam</p>
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
    return wrap(
      <div className="space-y-6 text-center">
        <h2 className="text-2xl">Un mensaje para el futuro</h2>
        <p className="text-lg leading-relaxed opacity-85">
          {event.description?.trim() ||
            `Graba un vídeo de hasta ${TIME_CAPSULE_MAX_VIDEO_SECONDS} segundos para los novios. Nadie podrá verlo: quedará guardado y sellado hasta el ${openDateLabel}, cuando lo abrirán juntos y volverán a vivir este día.`}
        </p>
        <div className="capsule-rule" />
        <p className="capsule-eyebrow">Se abrirá en {capsuleSettings.years} años · {openDateLabel}</p>
        <button type="button" className="capsule-btn" onClick={() => setStep("name")}>
          <Heart className="w-4 h-4" /> Empezar
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
          className="capsule-input"
          value={guestName}
          onChange={(inputEvent) => setGuestName(inputEvent.target.value)}
          placeholder="Tu nombre"
          maxLength={60}
          autoFocus
        />
        <button type="submit" className="capsule-btn" disabled={guestName.trim().length < 2}>
          Continuar
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

  return wrap(
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-2xl">Graba tu mensaje</h2>
        <p className="text-base opacity-75">Máximo {TIME_CAPSULE_MAX_VIDEO_SECONDS} segundos</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-black/80 aspect-[3/4]">
        {recordedUrl ? (
          <video src={recordedUrl} controls playsInline className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        )}
        {isRecording && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-sm text-white tracking-widest">
            ● {formatSeconds(TIME_CAPSULE_MAX_VIDEO_SECONDS - elapsed)}
          </div>
        )}
      </div>

      {recordError && <p className="text-center text-sm text-red-600">{recordError}</p>}

      {recordedBlob ? (
        <div className="space-y-3">
          <button type="button" className="capsule-btn" onClick={sendVideo} disabled={isSending}>
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSending ? "Enviando" : "Enviar a la cápsula"}
          </button>
          <button
            type="button"
            className="capsule-btn capsule-btn-ghost"
            onClick={resetRecording}
            disabled={isSending}
          >
            <RotateCcw className="w-4 h-4" /> Volver a grabar
          </button>
        </div>
      ) : isRecording ? (
        <button type="button" className="capsule-btn" onClick={stopRecording}>
          <Square className="w-4 h-4" /> Terminar
        </button>
      ) : (
        <button type="button" className="capsule-btn" onClick={startRecording}>
          <Video className="w-4 h-4" /> Grabar
        </button>
      )}
    </div>,
  );
};

export default TimeCapsule;
