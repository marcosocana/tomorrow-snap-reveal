import { useEffect, useRef, useState } from "react";
import { Camera, Film, RotateCcw, Square, SwitchCamera, X } from "lucide-react";

const MAX_VIDEO_SECONDS = 30;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const VIDEO_BITS_PER_SECOND = 1_800_000;
const AUDIO_BITS_PER_SECOND = 96_000;
const PHOTO_MAX_DIMENSION = 1600;
const THUMBNAIL_MAX_WIDTH = 480;

const supportedVideoType = () => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return ["video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) ?? "";
};

const extensionFor = (mimeType: string) => mimeType.includes("mp4") ? "mp4" : "webm";

const canvasFile = (video: HTMLVideoElement, maxWidth: number, quality: number, name: string) => new Promise<File>((resolve, reject) => {
  if (!video.videoWidth || !video.videoHeight) {
    reject(new Error("La cámara todavía no está preparada."));
    return;
  }
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    reject(new Error("No se ha podido preparar la imagen."));
    return;
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (!blob) reject(new Error("No se ha podido preparar la imagen."));
    else resolve(new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }));
  }, "image/jpeg", quality);
});

export default function MediaCapture({ kind, file, onChange, onThumbnailChange, onPreparingChange, disabled }: {
  kind: "photo" | "video";
  file: File | null;
  onChange: (file: File | null) => void;
  onThumbnailChange?: (file: File | null) => void;
  onPreparingChange?: (preparing: boolean) => void;
  disabled: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(MAX_VIDEO_SECONDS);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const preparingChangeRef = useRef(onPreparingChange);
  const mountedRef = useRef(true);
  preparingChangeRef.current = onPreparingChange;

  const clearTimers = () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (stopTimeoutRef.current) window.clearTimeout(stopTimeoutRef.current);
    intervalRef.current = null;
    stopTimeoutRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraReady(false);
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream();
    };
  }, []);

  const openCamera = async (nextFacing = facingMode) => {
    setError("");
    onChange(null);
    onThumbnailChange?.(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite usar la cámara desde el juego. Ábrelo en Safari o Chrome y concede permiso a la cámara.");
      return;
    }
    if (kind === "video" && typeof MediaRecorder === "undefined") {
      setError("Este navegador no permite grabar vídeo desde el juego. Ábrelo en Safari o Chrome actualizado.");
      return;
    }
    onPreparingChange?.(true);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: kind === "video",
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setSecondsLeft(MAX_VIDEO_SECONDS);
    } catch {
      setError("Necesitamos permiso para usar la cámara y el micrófono.");
      onPreparingChange?.(false);
    }
  };

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    void video.play().then(() => setCameraReady(true)).catch(() => {
      setError("No se ha podido iniciar la cámara.");
      stopStream();
    }).finally(() => preparingChangeRef.current?.(false));
  }, [cameraOpen]);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    onPreparingChange?.(true);
    try {
      const stamp = Date.now();
      const [photo, thumbnail] = await Promise.all([
        canvasFile(video, PHOTO_MAX_DIMENSION, .84, `capitanes-${stamp}.jpg`),
        canvasFile(video, THUMBNAIL_MAX_WIDTH, .76, `capitanes-${stamp}-miniatura.jpg`),
      ]);
      onThumbnailChange?.(thumbnail);
      onChange(photo);
      stopStream();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido hacer la foto.");
    } finally {
      onPreparingChange?.(false);
    }
  };

  const stopRecording = () => {
    clearTimers();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !cameraReady) return;
    setError("");
    chunksRef.current = [];
    const mimeType = supportedVideoType();
    const preferred: MediaRecorderOptions = {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    };
    try {
      let recorder: MediaRecorder;
      try { recorder = new MediaRecorder(stream, preferred); }
      catch { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        setError("La grabación se ha interrumpido. Vuelve a intentarlo.");
        setRecording(false);
        clearTimers();
      };
      recorder.onstop = () => {
        if (!mountedRef.current) return;
        const actualType = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: actualType });
        setRecording(false);
        clearTimers();
        if (!blob.size || blob.size > MAX_VIDEO_BYTES) {
          setError("El vídeo supera 25 MB. Vuelve a grabarlo.");
          stopStream();
          return;
        }
        onPreparingChange?.(true);
        const stamp = Date.now();
        void canvasFile(videoRef.current!, THUMBNAIL_MAX_WIDTH, .76, `capitanes-${stamp}-miniatura.jpg`)
          .catch(() => null)
          .then(thumbnail => {
            onThumbnailChange?.(thumbnail);
            onChange(new File([blob], `capitanes-${stamp}.${extensionFor(actualType)}`, { type: actualType, lastModified: stamp }));
            stopStream();
          })
          .finally(() => preparingChangeRef.current?.(false));
      };
      recorder.start(1000);
      setRecording(true);
      setSecondsLeft(MAX_VIDEO_SECONDS);
      intervalRef.current = window.setInterval(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000);
      stopTimeoutRef.current = window.setTimeout(stopRecording, MAX_VIDEO_SECONDS * 1000);
    } catch {
      setError("No se ha podido iniciar la grabación.");
    }
  };

  const switchCamera = async () => {
    if (recording) return;
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await openCamera(next);
  };

  if (file && previewUrl) return <div className="cv2-capture">
    {kind === "photo"
      ? <img className="cv2-capture-preview" src={previewUrl} alt="Foto que vas a enviar" />
      : <video className="cv2-capture-preview" src={previewUrl} controls playsInline preload="metadata" />}
    <button className="cv2-secondary cv2-camera-button" disabled={disabled} onClick={() => void openCamera()}><RotateCcw size={19} />Repetir</button>
  </div>;

  return <div className="cv2-capture">
    {cameraOpen ? <div className="cv2-camera-stage">
      <video ref={videoRef} className="cv2-capture-live" muted playsInline style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }} />
      {kind === "video" && <span className={`cv2-recording-time ${recording ? "is-recording" : ""}`}>{recording ? `00:${String(MAX_VIDEO_SECONDS - secondsLeft).padStart(2, "0")} / 00:30` : "Máximo 30 s"}</span>}
      <div className="cv2-camera-controls">
        <button type="button" onClick={stopStream} disabled={recording} aria-label="Cerrar cámara"><X size={20} /></button>
        {kind === "photo"
          ? <button type="button" className="cv2-shutter" onClick={() => void takePhoto()} disabled={!cameraReady} aria-label="Hacer foto"><Camera size={25} /></button>
          : <button type="button" className={`cv2-record ${recording ? "is-recording" : ""}`} onClick={recording ? stopRecording : startRecording} disabled={!cameraReady} aria-label={recording ? "Detener grabación" : "Empezar grabación"}>{recording ? <Square size={20} /> : <Film size={23} />}</button>}
        <button type="button" onClick={() => void switchCamera()} disabled={recording} aria-label="Cambiar cámara"><SwitchCamera size={20} /></button>
      </div>
    </div> : <button className="cv2-secondary cv2-camera-button" disabled={disabled} onClick={() => void openCamera()}>{kind === "photo" ? <Camera size={19} /> : <Film size={19} />}{kind === "photo" ? "Abrir cámara" : "Abrir cámara de vídeo"}</button>}
    {error && <p role="alert" className="cv2-error">{error}</p>}
  </div>;
}
