import { useEffect, useRef, useState } from "react";
import { Camera, Film, RotateCcw } from "lucide-react";

export default function MediaCapture({ kind, file, onChange, onThumbnailChange, onPreparingChange, disabled }: {
  kind: "photo" | "video";
  file: File | null;
  onChange: (file: File | null) => void;
  onThumbnailChange?: (file: File | null) => void;
  onPreparingChange?: (preparing: boolean) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const request = useRef(0);
  const camera = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) { setUrl(""); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  useEffect(() => () => { request.current++; }, []);

  const selectFile = async (candidate?: File) => {
    if (!candidate) return;
    const version = ++request.current;
    setError("");
    onChange(null);
    onThumbnailChange?.(null);
    if (!candidate.type.startsWith(kind === "photo" ? "image/" : "video/")) {
      setError(kind === "photo" ? "Elige una foto válida." : "Elige un vídeo válido."); return;
    }
    if (candidate.size === 0 || candidate.size > 100 * 1024 * 1024) {
      setError("El archivo debe tener contenido y ocupar menos de 100 MB."); return;
    }
    setChecking(true);
    onPreparingChange?.(true);
    const preview = URL.createObjectURL(candidate);
    try {
      const thumbnail = await new Promise<File | null>((resolve, reject) => {
        const media = kind === "photo" ? new Image() : document.createElement("video");
        const timer = window.setTimeout(() => finish(false), kind === "video" ? 30000 : 15000);
        let settled = false;
        const finish = (valid: boolean, result: File | null = null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          media.removeAttribute("src");
          if (media instanceof HTMLVideoElement) media.load();
          if (valid) resolve(result);
          else reject(new Error("No podemos abrir este archivo. Prueba otra foto o vídeo."));
        };
        media.onerror = () => finish(false);
        if (media instanceof HTMLVideoElement) {
          media.preload = "metadata";
          // Safari/iPhone can report duration 0 or Infinity while a freshly recorded
          // video is already decodable. Generate the thumbnail once frame data exists.
          const captureFirstFrame = () => {
            if (settled || media.videoWidth <= 0 || media.videoHeight <= 0 || media.readyState < 2) return;
            const maxWidth = 720;
            const scale = Math.min(1, maxWidth / media.videoWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(media.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(media.videoHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) { finish(false); return; }
            context.drawImage(media, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
              if (!blob) { finish(false); return; }
              const baseName = candidate.name.replace(/\.[^.]+$/, "") || "video";
              finish(true, new File([blob], `${baseName}-miniatura.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
            }, "image/jpeg", .82);
          };
          media.onloadedmetadata = () => {
            if (media.readyState >= 2) captureFirstFrame();
            else if (Number.isFinite(media.duration) && media.duration > .05) media.currentTime = .05;
          };
          media.onloadeddata = captureFirstFrame;
          media.onseeked = captureFirstFrame;
        } else media.onload = () => finish(media.naturalWidth > 0);
        media.src = preview;
      });
      if (request.current === version) {
        onThumbnailChange?.(thumbnail);
        onChange(candidate);
      }
    } catch (cause) {
      if (request.current === version) setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo.");
    } finally {
      URL.revokeObjectURL(preview);
      if (request.current === version) {
        setChecking(false);
        onPreparingChange?.(false);
      }
    }
  };
  return <div className="cv2-capture">
    {url && (kind === "photo" ? <img className="cv2-capture-preview" src={url} alt="Foto que vas a enviar" /> : <video className="cv2-capture-preview" src={url} controls playsInline preload="metadata" />)}
    <input ref={camera} className="sr-only" tabIndex={-1} aria-label={kind === "photo" ? "Hacer una foto" : "Grabar un vídeo"} type="file" accept={kind === "photo" ? "image/*" : "video/*"} capture="environment" disabled={disabled || checking} onChange={event => { void selectFile(event.target.files?.[0]); event.target.value = ""; }} />
    <button className="cv2-secondary cv2-camera-button" disabled={disabled || checking} onClick={() => { if (file) { onChange(null); onThumbnailChange?.(null); } else camera.current?.click(); }}>{file ? <RotateCcw size={19} /> : kind === "photo" ? <Camera size={19} /> : <Film size={19} />}{file ? "Repetir" : kind === "photo" ? "Hacer una foto" : "Grabar un vídeo"}</button>
    {checking && <p role="status">Preparando {kind === "photo" ? "la foto" : "el vídeo"}…</p>}
    {error && <p role="alert" className="cv2-error">{error}</p>}
  </div>;
}
