import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Camera, Check, Download, Images, RefreshCw, X } from "lucide-react";
import { PhotoboothShell } from "@/components/photostrip/PhotoboothShell";
import { captureVideoFrame, generatePhotostrip } from "@/lib/generatePhotostrip";
import {
  downloadPhotostrip,
  getPhotostripIdentity,
  photostripApi,
  type PhotostripGalleryItem,
  type PhotostripMode,
  type PhotostripParticipationResult,
  type PublicPhotostripEvent,
} from "@/lib/photostrip";

type Stage = "loading" | "landing" | "mode" | "camera" | "capturing" | "preview" | "saving" | "result" | "removed" | "error";

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const humanError = (error: unknown) => {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code.includes("NotAllowedError") || code === "CAMERA_DENIED") return "Necesitamos permiso para usar la cámara. Actívalo en los ajustes del navegador e inténtalo de nuevo.";
  if (code.includes("NotFoundError") || code.includes("NotReadableError") || code === "CAMERA_NOT_READY" || code === "CAMERA_UNAVAILABLE") return "No hemos encontrado una cámara disponible. Revisa que ninguna otra aplicación la esté usando.";
  if (code === "EVENT_NOT_ACTIVE") return "El fotomatón no está disponible en este momento.";
  if (code === "PHOTOSTRIP_LIMIT_REACHED") return "La demo ya ha utilizado sus 3 tiras disponibles.";
  if (code === "PARTICIPATION_ALREADY_CLAIMED") return "Esta participación ya está asociada a otra sesión.";
  if (code === "SAVE_FAILED" || code === "Failed to fetch") return "No hemos podido guardar tu tira. Comprueba la conexión y vuelve a intentarlo.";
  return "Algo no ha salido bien. Vuelve a intentarlo.";
};

const Availability = ({ event }: { event: PublicPhotostripEvent }) => {
  const message = event.availability === "upcoming"
    ? "EL FOTOMATÓN TODAVÍA NO ESTÁ DISPONIBLE"
    : event.availability === "ended"
      ? "EL FOTOMATÓN HA TERMINADO"
      : "ESTE PHOTOSTRIP NO ESTÁ DISPONIBLE";
  return (
    <div className="photostrip-center-copy">
      <p className="photostrip-kicker">{event.name}</p>
      <h1>{message}</h1>
      {event.galleryAllowed ? <Link className="photostrip-secondary-button" to={`/photostrip/${event.slug}/gallery`}>VER GALERÍA</Link> : null}
    </div>
  );
};

const PhotostripGallery = ({ slug }: { slug: string }) => {
  const [event, setEvent] = useState<PublicPhotostripEvent | null>(null);
  const [items, setItems] = useState<PhotostripGalleryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PhotostripGalleryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    try {
      setLoading(true);
      const response = await photostripApi<{ event: PublicPhotostripEvent; strips: PhotostripGalleryItem[]; hasMore: boolean }>({
        action: "gallery", slug, page: nextPage, limit: 24,
      });
      setEvent(response.event);
      setItems((current) => nextPage === 0 ? response.strips : [...current, ...response.strips]);
      setHasMore(response.hasMore);
      setPage(nextPage);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message === "GALLERY_PRIVATE"
        ? "Esta galería es privada."
        : "No hemos podido cargar la galería.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(0); }, [load]);

  const downloadGalleryItem = async (item: PhotostripGalleryItem) => {
    try {
      const response = await photostripApi<{ stripUrl: string }>({ action: "gallery-download", slug, participationId: item.key });
      await downloadPhotostrip(response.stripUrl, slug);
    } catch { setError("No hemos podido descargar la tira."); }
  };

  return (
    <div className="photostrip-gallery-page">
      <header className="photostrip-gallery-header">
        <Link to={`/photostrip/${slug}`} className="photostrip-back-link">← VOLVER</Link>
        <p>EL MURO DE PHOTOSTRIPS</p>
        <h1>{event?.name || "Photostrip"}</h1>
      </header>
      {error ? <p className="photostrip-message">{error}</p> : null}
      {!loading && !error && items.length === 0 ? <p className="photostrip-message">TODAVÍA NO HAY TIRAS. SÉ EL PRIMERO.</p> : null}
      <div className="photostrip-gallery-grid">
        {items.map((item, index) => (
          <button key={`${item.key}-${index}`} type="button" className="photostrip-gallery-card" onClick={() => setSelected(item)}>
            <img src={item.thumbnailUrl} alt={`Photostrip ${index + 1}`} loading="lazy" />
          </button>
        ))}
      </div>
      {loading ? <p className="photostrip-message">CARGANDO GALERÍA...</p> : null}
      {hasMore && !loading ? <button className="photostrip-ink-button mx-auto" onClick={() => void load(page + 1)}>CARGAR MÁS</button> : null}
      {selected ? (
        <div className="photostrip-viewer" role="dialog" aria-modal="true" aria-label="Photostrip ampliado">
          <button className="photostrip-viewer-close" onClick={() => setSelected(null)} aria-label="Cerrar"><X /></button>
          <img src={selected.stripUrl} alt="Photostrip completo" />
          <button className="photostrip-ink-button" onClick={() => void downloadGalleryItem(selected)}><Download /> DESCARGAR</button>
        </div>
      ) : null}
    </div>
  );
};

const PhotostripExperience = ({ slug }: { slug: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photosRef = useRef<Blob[]>([]);
  const photoUrlsRef = useRef<string[]>([]);
  const stripObjectUrlRef = useRef<string | null>(null);
  const [event, setEvent] = useState<PublicPhotostripEvent | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [mode, setMode] = useState<PhotostripMode>("color");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureIndex, setCaptureIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [stripPreview, setStripPreview] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retakeIndex, setRetakeIndex] = useState<number | null>(null);
  const identityRef = useRef(getPhotostripIdentity(slug));

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const replacePhotoState = (blobs: Blob[]) => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    photosRef.current = blobs;
    photoUrlsRef.current = blobs.map((blob) => URL.createObjectURL(blob));
    setPhotoUrls([...photoUrlsRef.current]);
  };

  const buildPreview = async (blobs: Blob[], selectedMode: PhotostripMode, currentEvent: PublicPhotostripEvent) => {
    const strip = await generatePhotostrip(blobs, {
      mode: selectedMode,
      eventName: currentEvent.stripDisplayName,
      eventDate: currentEvent.startsAt,
      footerText: currentEvent.stripFooterText,
      logoUrl: currentEvent.logoUrl,
    });
    if (stripObjectUrlRef.current) URL.revokeObjectURL(stripObjectUrlRef.current);
    stripObjectUrlRef.current = URL.createObjectURL(strip);
    setStripPreview(stripObjectUrlRef.current);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await photostripApi<{ event: PublicPhotostripEvent }>({ action: "event", slug });
        if (!active) return;
        setEvent(response.event);
        const identity = identityRef.current;
        const existing = await photostripApi<{ participation: PhotostripParticipationResult | null }>({
          action: "participation", slug, participantId: identity.id, participantToken: identity.token,
        });
        if (!active) return;
        if (existing.participation?.removed) setStage("removed");
        else if (existing.participation?.status === "completed" && existing.participation.stripUrl) {
          setMode(existing.participation.mode);
          setResultUrl(existing.participation.stripUrl);
          setStage("result");
        } else setStage("landing");
      } catch (loadError) {
        if (active) { setError(humanError(loadError)); setStage("error"); }
      }
    })();
    return () => { active = false; stopCamera(); };
  }, [slug, stopCamera]);

  useEffect(() => () => {
    photoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    if (stripObjectUrlRef.current) URL.revokeObjectURL(stripObjectUrlRef.current);
  }, []);

  const openCamera = async (selectedMode: PhotostripMode) => {
    if (!event) return;
    try {
      setError(null);
      setMode(selectedMode);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAMERA_UNAVAILABLE");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1600 }, height: { ideal: 1200 } }, audio: false });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      const identity = identityRef.current;
      const started = await photostripApi<{ status: string; stripUrl?: string }>({
        action: "start", slug, participantId: identity.id, participantToken: identity.token, mode: selectedMode,
      });
      if (started.status === "completed" && started.stripUrl) {
        stream.getTracks().forEach((track) => track.stop());
        setResultUrl(started.stripUrl);
        setStage("result");
        return;
      }
      streamRef.current = stream;
      setStage("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (cameraError) {
      stopCamera();
      setError(humanError(cameraError instanceof DOMException ? new Error(cameraError.name) : cameraError));
      setStage("landing");
    }
  };

  const runCountdown = async () => {
    const seconds = event?.countdownSeconds || 3;
    for (let value = seconds; value > 0; value -= 1) {
      setCountdown(value);
      await wait(900);
    }
    setCountdown(null);
  };

  const captureOne = async () => {
    if (!videoRef.current) throw new Error("CAMERA_NOT_READY");
    await runCountdown();
    setFlash(true);
    await wait(140);
    const blob = await captureVideoFrame(videoRef.current, mode);
    setFlash(false);
    return blob;
  };

  const captureSequence = async () => {
    if (!event) return;
    try {
      setStage("capturing");
      const captured: Blob[] = [];
      for (let index = 0; index < 4; index += 1) {
        setCaptureIndex(index);
        captured.push(await captureOne());
        if (index < 3) await wait(550);
      }
      replacePhotoState(captured);
      await buildPreview(captured, mode, event);
      setStage("preview");
    } catch (captureError) {
      setError(humanError(captureError));
      setStage("camera");
    }
  };

  const retake = async () => {
    if (retakeIndex === null || !event) return;
    try {
      setStage("capturing");
      const replacement = await captureOne();
      const next = [...photosRef.current];
      next[retakeIndex] = replacement;
      replacePhotoState(next);
      await buildPreview(next, mode, event);
      setRetakeIndex(null);
      setStage("preview");
    } catch (retakeError) {
      setError(humanError(retakeError));
      setStage("preview");
    }
  };

  const finalize = async () => {
    if (!event || photosRef.current.length !== 4) return;
    try {
      setStage("saving");
      const strip = await generatePhotostrip(photosRef.current, {
        mode, eventName: event.stripDisplayName, eventDate: event.startsAt,
        footerText: event.stripFooterText, logoUrl: event.logoUrl,
      });
      const thumbnail = await generatePhotostrip(photosRef.current, {
        mode, eventName: event.stripDisplayName, eventDate: event.startsAt,
        footerText: event.stripFooterText, logoUrl: event.logoUrl, thumbnail: true,
      });
      const form = new FormData();
      const identity = identityRef.current;
      form.set("slug", slug);
      form.set("participantId", identity.id);
      form.set("participantToken", identity.token);
      photosRef.current.forEach((photo, index) => form.set(`photo${index + 1}`, photo, `photo-${index + 1}.webp`));
      form.set("strip", strip, "strip.webp");
      form.set("thumbnail", thumbnail, "thumbnail.webp");
      const response = await photostripApi<{ stripUrl: string }>(form);
      stopCamera();
      setResultUrl(response.stripUrl);
      setError(null);
      setStage("result");
    } catch (saveError) {
      setError(humanError(saveError));
      setStage("preview");
    }
  };

  const downloadOwnStrip = async () => {
    try {
      const identity = identityRef.current;
      const response = await photostripApi<{ stripUrl: string }>({
        action: "download", slug, participantId: identity.id, participantToken: identity.token,
      });
      await downloadPhotostrip(response.stripUrl, slug);
    } catch (downloadError) { setError(humanError(downloadError)); }
  };

  if (stage === "loading") return <PhotoboothShell><p className="photostrip-message">PREPARANDO EL FOTOMATÓN...</p></PhotoboothShell>;
  if (!event || stage === "error") return <PhotoboothShell><div className="photostrip-center-copy"><h1>ESTE PHOTOSTRIP YA NO ESTÁ DISPONIBLE</h1><p>{error}</p></div></PhotoboothShell>;
  if (event.availability !== "active" && stage !== "result") return <PhotoboothShell><Availability event={event} /></PhotoboothShell>;
  if (stage === "removed") return <PhotoboothShell><div className="photostrip-center-copy"><h1>TU PHOTOSTRIP YA NO ESTÁ DISPONIBLE</h1>{event.galleryAllowed ? <Link className="photostrip-secondary-button" to={`/photostrip/${slug}/gallery`}>VER GALERÍA</Link> : null}</div></PhotoboothShell>;

  return (
    <PhotoboothShell>
      {stage === "landing" ? (
        <div
          className={`photostrip-center-copy photostrip-cover${event.coverImageUrl ? " has-background" : ""}`}
          style={event.coverImageUrl ? { backgroundImage: `linear-gradient(rgba(24,18,15,.48), rgba(24,18,15,.72)), url("${event.coverImageUrl}")` } : undefined}
        >
          <div className="photostrip-cover-content">
          {event.logoUrl ? <img className="photostrip-event-logo" src={event.logoUrl} alt="Revelao" /> : null}
          <p className="photostrip-kicker">PHOTOSTRIP</p>
          <h1>{event.name}</h1>
          <p>4 fotos. {event.countdownSeconds} segundos entre cada una.<br />Una tira para recordar esta noche.</p>
          {error ? <p className="photostrip-error">{error}</p> : null}
          <button className="photostrip-ink-button" onClick={() => event.photoMode === "both" ? setStage("mode") : void openCamera(event.photoMode)}>ENTRAR AL FOTOMATÓN</button>
          {event.galleryAllowed ? <Link className="photostrip-text-link" to={`/photostrip/${slug}/gallery`}>VER FOTOS DE OTROS INVITADOS</Link> : null}
          </div>
        </div>
      ) : null}

      {stage === "mode" ? (
        <div className="photostrip-center-copy">
          <p className="photostrip-kicker">ELIGE TU ACABADO</p><h1>¿COLOR O BLANCO Y NEGRO?</h1>
          <div className="photostrip-mode-grid">
            <button onClick={() => void openCamera("color")}><span className="photostrip-color-swatch" />COLOR</button>
            <button onClick={() => void openCamera("bw")}><span className="photostrip-bw-swatch" />B&amp;W</button>
          </div>
        </div>
      ) : null}

      {["camera", "capturing"].includes(stage) ? (
        <div className="photostrip-camera-stage">
          <div className="photostrip-camera-frame">
            <video ref={videoRef} playsInline muted aria-label="Vista previa de la cámara" />
            {countdown !== null ? <span className="photostrip-countdown">{countdown}</span> : null}
            {stage === "capturing" ? <span className="photostrip-progress">FOTO {captureIndex + 1} / 4</span> : null}
            {flash ? <span className="photostrip-flash" /> : null}
          </div>
          {stage === "camera" ? <button className="photostrip-ink-button" onClick={() => void captureSequence()}><Camera /> START</button> : <p className="photostrip-message">NO TE MUEVAS...</p>}
        </div>
      ) : null}

      {stage === "preview" ? (
        <div className="photostrip-preview-stage">
          <div><p className="photostrip-kicker">TU TIRA</p><h1>¿LA IMPRIMIMOS?</h1></div>
          {stripPreview ? <img className="photostrip-strip-preview" src={stripPreview} alt="Vista previa de tu tira" /> : null}
          <div className="photostrip-thumbnails" aria-label="Selecciona una foto para repetirla">
            {photoUrls.map((url, index) => <button key={url} className={retakeIndex === index ? "selected" : ""} onClick={() => setRetakeIndex(index)}><img src={url} alt={`Foto ${index + 1}`} /></button>)}
          </div>
          {error ? <p className="photostrip-error">{error}</p> : null}
          <div className="photostrip-preview-actions">
            <button className="photostrip-ink-button" onClick={() => void finalize()}><Check /> IMPRIMIR</button>
            <button className="photostrip-secondary-button" disabled={retakeIndex === null} onClick={() => void retake()}><RefreshCw /> REPETIR FOTO</button>
          </div>
        </div>
      ) : null}

      {stage === "saving" ? <div className="photostrip-developing"><p>REVELANDO...</p><span className="photostrip-developing-strip">4 · 3 · 2 · 1</span><p>GUARDANDO TU PHOTOSTRIP...</p></div> : null}

      {stage === "result" && resultUrl ? (
        <div className="photostrip-result">
          <p className="photostrip-kicker">TU PHOTOSTRIP</p><h1>RECIÉN REVELADO</h1>
          <img className="photostrip-strip-preview" src={resultUrl} alt="Tu Photostrip terminado" />
          <button className="photostrip-ink-button" onClick={() => void downloadOwnStrip()}><Download /> DESCARGAR TIRA</button>
          {event.galleryAllowed ? <Link className="photostrip-secondary-button" to={`/photostrip/${slug}/gallery`}><Images /> VER FOTOS DE OTROS INVITADOS</Link> : null}
        </div>
      ) : null}
    </PhotoboothShell>
  );
};

const PhotostripPublic = () => {
  const { eventSlug = "" } = useParams();
  const location = useLocation();
  return location.pathname.endsWith("/gallery")
    ? <PhotostripGallery slug={eventSlug} />
    : <PhotostripExperience slug={eventSlug} />;
};

export default PhotostripPublic;
