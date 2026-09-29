import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useParams } from "react-router-dom";
import { Aperture, ArrowRight, ArrowUpRight, ChevronRight, Lock, ZapOff } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import {
  CarreteoApiError,
  carreteoApi,
  getCarreteoIdentity,
  playShutter,
  playWindLock,
  playWindTick,
  unlockCarreteoAudio,
  type PublicCarreteoEvent,
} from "@/lib/carreteo";
import { CarreteoGallery } from "@/components/carreteo/CarreteoGallery";
import { useToast } from "@/hooks/use-toast";
import "./CarreteoPublic.css";

type CameraState = "idle" | "starting" | "ready" | "error";
type Effect = { kind: "flash" | "blink"; key: number } | null;
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

// Recorrido de la rueda en unidades del lienzo de diseño (la rueda mide 131).
const WIND_TRAVEL = 88;
const TICK_EVERY = 11;
const WHEEL_WIDTH_UNITS = 131;
const MAX_TIMEOUT = 2_147_483_000;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is a nicety; some browsers throw outside a user gesture.
  }
};

// En vertical la cámara se dibuja girada 90° (ver CarreteoPublic.css), así que
// el eje de la rueda pasa a ser el vertical de la pantalla.
const isRotatedLayout = () => window.matchMedia("(orientation: portrait)").matches;

type FullscreenTarget = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null };
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

// Pantalla completa y horizontal al primer toque donde el navegador lo permite
// (Android). En iPhone no existe esta API y la cámara ocupa el área visible.
const enterFullscreen = () => {
  const doc = document as FullscreenDocument;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return;
  const root = document.documentElement as FullscreenTarget;
  const request = root.requestFullscreen
    ? () => root.requestFullscreen({ navigationUI: "hide" })
    : root.webkitRequestFullscreen?.bind(root);
  if (!request) return;
  try {
    void Promise.resolve(request())
      .then(() => (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape"))
      .catch(() => undefined);
  } catch {
    // Algunos navegadores lanzan en vez de rechazar; la cámara sigue funcionando.
  }
};

const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("CAPTURE_FAILED"))), "image/jpeg", quality);
});

const drawScaled = (video: HTMLVideoElement, maxSide: number) => {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CAPTURE_FAILED");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const WeeeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M7 7h10l-1 13H8L7 7Z" />
    <path d="M6 7h12M10 4h4" />
    <path d="M4 3l16 18M20 3 4 21" />
  </svg>
);

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="4" r="2.6" />
    <path d="M9.2 8h5.6c1 0 1.7.8 1.7 1.7v5.1c0 .6-.5 1.1-1.1 1.1h-.6V22a1 1 0 0 1-1 1h-3.6a1 1 0 0 1-1-1v-6.1h-.6c-.6 0-1.1-.5-1.1-1.1V9.7C7.5 8.8 8.2 8 9.2 8Z" />
  </svg>
);

const CarreteoWave = () => (
  <svg viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="crt-yellow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--crt-yellow-top)" />
        <stop offset="100%" stopColor="var(--crt-yellow-bottom)" />
      </linearGradient>
    </defs>
    <path d="M0 0H1000V128C945 143 885 151 822 151C650 149 470 117 310 119C185 120 85 131 0 138Z" fill="url(#crt-yellow)" />
    <path
      d="M0 138C85 131 185 120 310 119C470 117 650 149 822 151C885 151 945 143 1000 128"
      fill="none"
      stroke="var(--crt-red)"
      vectorEffect="non-scaling-stroke"
      style={{ strokeWidth: "calc(var(--u) * 3.2)" }}
    />
  </svg>
);

const CarreteoPublic = () => {
  const { eventSlug = "" } = useParams();
  const slug = eventSlug.toLowerCase();
  const { toast } = useToast();
  const identity = useMemo(() => getCarreteoIdentity(slug), [slug]);

  const [event, setEvent] = useState<PublicCarreteoEvent | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [shotsTaken, setShotsTaken] = useState(0);
  const [wound, setWound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [viewfinderOpen, setViewfinderOpen] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [effect, setEffect] = useState<Effect>(null);
  const [filmTipOpen, setFilmTipOpen] = useState(false);
  const [tickKey, setTickKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wheelRef = useRef<HTMLButtonElement>(null);
  const wheelOffset = useRef(0);
  const windLocked = useRef(false);
  const drag = useRef({ active: false, pointerId: -1, lastX: 0, moved: 0, travel: 0, sinceTick: 0 });

  const loadEvent = useCallback(async () => {
    try {
      const response = await carreteoApi<{ event: PublicCarreteoEvent; shotsTaken: number }>({
        action: "event",
        slug,
        participantId: identity.id,
        participantToken: identity.token,
      });
      setEvent(response.event);
      setShotsTaken(response.shotsTaken);
      setLoadState("ready");
    } catch (error) {
      setLoadState(error instanceof Error && error.message === "EVENT_NOT_FOUND" ? "not-found" : "error");
    }
  }, [identity, slug]);

  useEffect(() => { void loadEvent(); }, [loadEvent]);

  // Refresca el estado justo cuando el carrete abre, cierra o se revela.
  useEffect(() => {
    if (!event) return;
    const now = Date.now();
    const next = [event.startsAt, event.endsAt, event.revealAt]
      .map((value) => (value ? new Date(value).getTime() : NaN))
      .filter((time) => Number.isFinite(time) && time > now)
      .sort((left, right) => left - right)[0];
    if (!next || next - now > MAX_TIMEOUT) return;
    const timer = window.setTimeout(() => void loadEvent(), next - now + 1_000);
    return () => window.clearTimeout(timer);
  }, [event, loadEvent]);

  const totalShots = event?.shotsPerCamera ?? 25;
  const rollFinished = shotsTaken >= totalShots;
  const isActive = event?.availability === "active";

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setCameraState("error"); return; }
    setCameraState("starting");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraState("ready");
    } catch {
      setCameraState("error");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isActive || rollFinished) { stopCamera(); return; }
    if (cameraState === "idle") void startCamera();
  }, [cameraState, isActive, rollFinished, startCamera, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  // Mientras se ve la cámara la página no puede desplazarse, rebotar ni hacer zoom.
  const showsCamera = loadState === "ready" && Boolean(event) && event?.availability !== "revealed";
  useEffect(() => {
    if (!showsCamera) return;
    const roots = [document.documentElement, document.body];
    roots.forEach((element) => element.classList.add("crt-locked"));
    const preventScroll = (touchEvent: TouchEvent) => { if (touchEvent.cancelable) touchEvent.preventDefault(); };
    const preventGesture = (gestureEvent: Event) => gestureEvent.preventDefault();
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("gesturestart", preventGesture);
    window.scrollTo(0, 0);
    return () => {
      roots.forEach((element) => element.classList.remove("crt-locked"));
      document.removeEventListener("touchmove", preventScroll);
      document.removeEventListener("gesturestart", preventGesture);
    };
  }, [showsCamera]);

  const canWind = isActive && !wound && !saving && !rollFinished;
  const canShoot = isActive && wound && !saving && !rollFinished && cameraState === "ready";

  const paintWheel = () => {
    wheelRef.current?.style.setProperty("--crt-wheel-offset", `${wheelOffset.current}px`);
  };

  const setWindLocked = (locked: boolean) => {
    windLocked.current = locked;
    setWound(locked);
  };

  const completeWind = () => {
    drag.current = { ...drag.current, active: false, travel: 0, sinceTick: 0 };
    setWindLocked(true);
    playWindLock();
    vibrate([12, 40, 18]);
  };

  const advanceWheel = (units: number, offsetPx: number) => {
    if (windLocked.current) return;
    const state = drag.current;
    wheelOffset.current += offsetPx;
    paintWheel();
    state.travel += units;
    state.sinceTick += units;
    while (state.sinceTick >= TICK_EVERY) {
      state.sinceTick -= TICK_EVERY;
      playWindTick();
      vibrate(4);
    }
    if (state.travel >= WIND_TRAVEL) completeWind();
  };

  // offsetWidth ignora la rotación CSS: mide la rueda en píxeles de la propia cámara.
  const unitPx = () => (wheelRef.current?.offsetWidth ?? WHEEL_WIDTH_UNITS) / WHEEL_WIDTH_UNITS;

  // Un toque sin arrastre avanza unos dientes, como empujar la rueda con el pulgar.
  const nudgeWheel = () => {
    if (!canWind) return;
    const px = unitPx();
    for (let step = 0; step < 3; step += 1) {
      window.setTimeout(() => advanceWheel(TICK_EVERY, TICK_EVERY * px), step * 55);
    }
  };

  const onWheelPointerDown = (pointerEvent: ReactPointerEvent<HTMLButtonElement>) => {
    unlockCarreteoAudio();
    if (!canWind) return;
    pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId);
    const position = isRotatedLayout() ? pointerEvent.clientY : pointerEvent.clientX;
    drag.current = { ...drag.current, active: true, pointerId: pointerEvent.pointerId, lastX: position, moved: 0 };
  };

  const onWheelPointerMove = (pointerEvent: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state.active || pointerEvent.pointerId !== state.pointerId) return;
    const position = isRotatedLayout() ? pointerEvent.clientY : pointerEvent.clientX;
    const dx = position - state.lastX;
    state.lastX = position;
    const units = Math.abs(dx) / unitPx();
    state.moved += units;
    advanceWheel(units, dx);
  };

  const onWheelPointerUp = (pointerEvent: ReactPointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state.active || pointerEvent.pointerId !== state.pointerId) return;
    state.active = false;
    if (state.moved < 3) nudgeWheel();
  };

  const setTorch = async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.() as TorchCapabilities | undefined;
    if (!track || !capabilities?.torch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      return true;
    } catch {
      return false;
    }
  };

  const shoot = async () => {
    unlockCarreteoAudio();
    if (!canShoot || !event) return;
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      toast({ title: "La cámara aún se está preparando", description: "Espera un segundo y vuelve a disparar." });
      return;
    }

    playShutter();
    vibrate(28);
    setEffect({ kind: flashOn ? "flash" : "blink", key: Date.now() });
    const torchUsed = flashOn ? await setTorch(true) : false;
    if (torchUsed) await wait(140);

    let image: Blob;
    let thumbnail: Blob;
    try {
      image = await canvasBlob(drawScaled(video, 1920), 0.88);
      thumbnail = await canvasBlob(drawScaled(video, 480), 0.72);
    } catch {
      toast({ title: "No se pudo hacer la foto", variant: "destructive" });
      return;
    } finally {
      if (torchUsed) void setTorch(false);
    }

    const previousShots = shotsTaken;
    setWindLocked(false);
    setShotsTaken(previousShots + 1);
    setTickKey((key) => key + 1);
    setSaving(true);

    const form = new FormData();
    form.set("slug", event.slug);
    form.set("participantId", identity.id);
    form.set("participantToken", identity.token);
    form.set("image", new File([image], "shot.jpg", { type: "image/jpeg" }));
    form.set("thumbnail", new File([thumbnail], "thumb.jpg", { type: "image/jpeg" }));
    try {
      const response = await carreteoApi<{ shotsTaken: number }>(form);
      setShotsTaken(response.shotsTaken);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "ROLL_FINISHED") {
        const serverShots = error instanceof CarreteoApiError ? Number(error.payload.shotsTaken) : NaN;
        setShotsTaken(Number.isFinite(serverShots) ? serverShots : totalShots);
      } else if (code === "EVENT_NOT_ACTIVE") {
        setShotsTaken(previousShots);
        void loadEvent();
      } else if (code === "CAMERA_LIMIT_REACHED") {
        setShotsTaken(previousShots);
        toast({ title: "No quedan cámaras libres", description: "Este evento ha alcanzado el máximo de cámaras.", variant: "destructive" });
      } else {
        // La foto no llegó a guardarse: el carrete sigue avanzado para reintentar.
        setShotsTaken(previousShots);
        setWindLocked(true);
        toast({ title: "No se pudo guardar la foto", description: "Revisa tu conexión y vuelve a disparar.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const formatMoment = (value: string | null) => (value && event ? formatInTimeZone(new Date(value), event.timezone, "dd/MM · HH:mm") : "—");

  if (loadState === "loading") {
    return <div className="crt-center-message"><div className="crt-spinner" aria-label="Cargando" /></div>;
  }
  if (loadState === "not-found" || loadState === "error" || !event) {
    return (
      <div className="crt-center-message">
        <h1>CARRETEO.</h1>
        <p>{loadState === "not-found" ? "Este carrete no existe o ya no está disponible." : "No hemos podido cargar el carrete. Inténtalo de nuevo en unos segundos."}</p>
      </div>
    );
  }
  if (event.availability === "revealed") return <CarreteoGallery event={event} />;

  const status = (() => {
    if (event.availability === "upcoming") return { text: `ABRE EL ${formatMoment(event.startsAt)}` };
    if (event.availability === "closed") return { text: `SE REVELA EL ${formatMoment(event.revealAt)}` };
    if (event.availability === "inactive") return { text: "CÁMARA EN PAUSA" };
    if (rollFinished) return { text: "CARRETE COMPLETO" };
    if (saving) return { text: "GUARDANDO…" };
    if (cameraState === "error") return { text: "PERMITE EL ACCESO A LA CÁMARA", retry: true };
    if (wound) return { text: "LISTA PARA DISPARAR", icon: <ArrowRight aria-hidden="true" /> };
    return { text: "AVANZA LA RUEDA", icon: <ArrowUpRight aria-hidden="true" /> };
  })();

  const barGap = Math.min(3.4, 186 / (totalShots * 2));
  const legalNumber = String(event.eventNumber ?? 1).padStart(4, "0");

  return (
    <main
      className="crt-page"
      onPointerDown={() => { unlockCarreteoAudio(); enterFullscreen(); }}
      aria-label={`Carreteo · ${event.name}`}
    >
      <div className="crt-top"><CarreteoWave /></div>
      <div className="crt-stage">
        {[[5, 10], [95, 10], [5, 90], [95, 90]].map(([left, top]) => (
          <span key={`${left}-${top}`} className="crt-at crt-screw" style={{ left: `${left}%`, top: `${top}%` }} aria-hidden="true" />
        ))}

        <header className="crt-brand">
          <h1 className="crt-brand-name">CARRETEO<span>.</span></h1>
          <p className="crt-brand-sub">CÁMARA DE UN SOLO USO</p>
        </header>

        <button
          ref={wheelRef}
          type="button"
          className={`crt-at crt-wheel ${canWind ? "" : "is-locked"}`}
          aria-label="Rueda de arrastre: gírala para avanzar el carrete"
          aria-disabled={!canWind}
          onPointerDown={onWheelPointerDown}
          onPointerMove={onWheelPointerMove}
          onPointerUp={onWheelPointerUp}
          onPointerCancel={() => { drag.current.active = false; }}
          onKeyDown={(keyboardEvent) => {
            if (["Enter", " ", "ArrowRight", "ArrowLeft"].includes(keyboardEvent.key)) {
              keyboardEvent.preventDefault();
              unlockCarreteoAudio();
              nudgeWheel();
            }
          }}
        />
        <div className={`crt-at crt-step crt-step-wind ${canWind ? "is-pulsing" : "is-hidden"}`} aria-hidden="true">
          <span className="crt-step-badge">1</span><ArrowRight />
        </div>

        <button
          type="button"
          className={`crt-viewfinder-handle crt-at ${viewfinderOpen ? "is-open" : ""}`}
          aria-label={viewfinderOpen ? "Cerrar visor" : "Abrir visor"}
          aria-expanded={viewfinderOpen}
          onClick={() => setViewfinderOpen((open) => !open)}
        >
          <span className={`crt-viewfinder-dot ${cameraState === "ready" ? "is-ready" : cameraState === "error" ? "is-error" : ""}`} />
          <span className="crt-viewfinder-tab"><ChevronRight aria-hidden="true" /></span>
        </button>
        <div className={`crt-viewfinder ${viewfinderOpen ? "is-open" : ""}`} aria-hidden={!viewfinderOpen}>
          <video ref={videoRef} muted playsInline autoPlay />
          <span className="crt-viewfinder-frame" />
        </div>

        <span className={`crt-at crt-led ${flashOn ? "is-on" : ""}`} aria-hidden="true" />
        <button
          type="button"
          role="switch"
          aria-checked={flashOn}
          aria-label="Flash"
          className={`crt-at crt-flash-toggle ${flashOn ? "is-on" : ""}`}
          onClick={() => setFlashOn((on) => !on)}
        >
          <span className="crt-flash-knob" />
          <svg className="crt-flash-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.8L13.5 2Z" /></svg>
        </button>
        <span className="crt-at crt-label crt-flash-label">FLASH</span>
        <span className="crt-at crt-range"><PersonIcon />1–3 m</span>

        <div className="crt-at crt-dial" role="status" aria-label={`${shotsTaken} de ${totalShots} fotos`}>
          <div className="crt-dial-face">
            <span className="crt-dial-marker" />
            <span key={tickKey} className={`crt-dial-number ${tickKey ? "is-ticking" : ""}`}>{shotsTaken}</span>
            <span className="crt-dial-total">de {totalShots}</span>
          </div>
        </div>
        {status.retry ? (
          <button type="button" className="crt-at crt-status is-alert" onClick={() => void startCamera()}>{status.text}</button>
        ) : (
          <p className="crt-at crt-status" aria-live="polite" style={{ margin: 0 }}>{status.text}{status.icon ?? null}</p>
        )}
        <div
          className="crt-at crt-bars"
          style={{ gridTemplateColumns: `repeat(${totalShots}, 1fr)`, columnGap: `calc(var(--u) * ${barGap})` }}
          aria-hidden="true"
        >
          {Array.from({ length: totalShots }, (_, index) => <span key={index} className={index < shotsTaken ? "is-on" : ""} />)}
        </div>

        <button
          type="button"
          className="crt-at crt-film"
          aria-label={`Película Gold 400. Se revela el ${formatMoment(event.revealAt)}`}
          onClick={() => setFilmTipOpen((open) => !open)}
        >
          <Lock aria-hidden="true" />GOLD 400
        </button>
        {filmTipOpen ? <div className="crt-at crt-film-tooltip" role="tooltip">Tus fotos se revelan el {formatMoment(event.revealAt)}</div> : null}

        <button
          type="button"
          className={`crt-at crt-shutter ${canShoot ? "is-ready" : ""}`}
          aria-label="Disparar"
          disabled={!canShoot}
          onClick={() => void shoot()}
        >
          <span className="crt-shutter-ring"><Aperture aria-hidden="true" /></span>
        </button>
        <div className={`crt-at crt-step crt-step-shoot ${canShoot ? "is-pulsing" : "is-hidden"}`} aria-hidden="true">
          <span className="crt-step-badge">2</span>
        </div>

        <div className="crt-legal" aria-hidden="true">
          <p>CARRETEO™ · CÁMARA DE UN SOLO USO · APPAREIL PHOTO JETABLE</p>
          <p>PELÍCULA 400 · {totalShots} EXPOSICIONES · HECHO PARA RECORDAR</p>
          <p>DEVELOP · WIND · SHOOT · REPEAT — Nº {legalNumber} / ES</p>
        </div>
        <div className="crt-marks" aria-hidden="true">
          <span className="crt-mark-ce">CE</span>
          <WeeeIcon />
          <ZapOff />
          <span className="crt-mark-iso">800</span>
        </div>

      </div>

      {effect ? (
        <div
          key={effect.key}
          className={effect.kind === "flash" ? "crt-flash-burst" : "crt-shutter-blink"}
          onAnimationEnd={() => setEffect(null)}
        />
      ) : null}
    </main>
  );
};

export default CarreteoPublic;
