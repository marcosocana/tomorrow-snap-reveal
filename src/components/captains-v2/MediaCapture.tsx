import { useEffect, useRef, useState } from "react";
import { Camera, Film, ImagePlus, RotateCcw } from "lucide-react";

export default function MediaCapture({ kind, file, onChange, disabled }: {
  kind: "photo" | "video";
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const request = useRef(0);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
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
    if (!candidate.type.startsWith(kind === "photo" ? "image/" : "video/")) {
      setError(kind === "photo" ? "Elige una foto válida." : "Elige un vídeo válido."); return;
    }
    if (candidate.size === 0 || candidate.size > 100 * 1024 * 1024) {
      setError("El archivo debe tener contenido y ocupar menos de 100 MB."); return;
    }
    setChecking(true);
    const preview = URL.createObjectURL(candidate);
    try {
      await new Promise<void>((resolve, reject) => {
        const media = kind === "photo" ? new Image() : document.createElement("video");
        const timer = window.setTimeout(() => finish(false), 15000);
        const finish = (valid: boolean) => {
          clearTimeout(timer);
          media.removeAttribute("src");
          if (media instanceof HTMLVideoElement) media.load();
          if (valid) resolve();
          else reject(new Error("No podemos abrir este archivo. Prueba otra foto o vídeo."));
        };
        media.onerror = () => finish(false);
        if (media instanceof HTMLVideoElement) {
          media.preload = "metadata";
          media.onloadedmetadata = () => finish(media.videoWidth > 0 && media.duration > 0);
        } else media.onload = () => finish(media.naturalWidth > 0);
        media.src = preview;
      });
      if (request.current === version) onChange(candidate);
    } catch (cause) {
      if (request.current === version) setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo.");
    } finally {
      URL.revokeObjectURL(preview);
      if (request.current === version) setChecking(false);
    }
  };
  return <div className="cv2-capture">
    {url && (kind === "photo" ? <img className="cv2-capture-preview" src={url} alt="Foto que vas a enviar" /> : <video className="cv2-capture-preview" src={url} controls playsInline preload="metadata" />)}
    <input ref={camera} className="sr-only" tabIndex={-1} aria-label={kind === "photo" ? "Hacer una foto" : "Grabar un vídeo"} type="file" accept={kind === "photo" ? "image/*" : "video/*"} capture="environment" disabled={disabled || checking} onChange={event => { void selectFile(event.target.files?.[0]); event.target.value = ""; }} />
    <input ref={library} className="sr-only" tabIndex={-1} aria-label="Elegir archivo del móvil" type="file" accept={kind === "photo" ? "image/*" : "video/*"} disabled={disabled || checking} onChange={event => { void selectFile(event.target.files?.[0]); event.target.value = ""; }} />
    <button className="cv2-secondary cv2-camera-button" disabled={disabled || checking} onClick={() => camera.current?.click()}>{file ? <RotateCcw size={19} /> : kind === "photo" ? <Camera size={19} /> : <Film size={19} />}{file ? "Volver a capturar" : kind === "photo" ? "Hacer una foto" : "Grabar un vídeo"}</button>
    <button className="cv2-secondary" disabled={disabled || checking} onClick={() => library.current?.click()}><ImagePlus size={17} />{file ? "Elegir otro archivo" : "Elegir del móvil"}</button>
    {checking && <p role="status">Preparando archivo…</p>}
    {error && <p role="alert" className="cv2-error">{error}</p>}
  </div>;
}
