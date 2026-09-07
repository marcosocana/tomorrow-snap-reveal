import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HostPhotoEditor({ photoUrl, onChange }: { photoUrl?: string | null; onChange: (url: string | null) => void }) {
  const [source, setSource] = useState<string | null>(null);
  const [adjust, setAdjust] = useState({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => () => { if (source) URL.revokeObjectURL(source); }, [source]);
  useEffect(() => {
    setReady(false);
    if (!source) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const ctx = canvas.current?.getContext("2d");
      if (!ctx) return;
      const size = 720;
      const scale = Math.max(size / image.width, size / image.height) * adjust.zoom;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath(); ctx.arc(360, 360, 360, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(image, (size - image.width * scale) / 2 + adjust.x * size / 100, (size - image.height * scale) / 2 + adjust.y * size / 100, image.width * scale, image.height * scale);
      ctx.restore(); setReady(true);
    };
    image.onerror = () => { if (!cancelled) setError("No se puede leer esta foto. Prueba con JPG o PNG."); };
    image.src = source;
    return () => { cancelled = true; };
  }, [source, adjust]);
  const save = async () => {
    if (!ready || !canvas.current) return;
    setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(value => value ? resolve(value) : reject(new Error()), "image/png"));
      const path = `captains/captain-photos/hosts/${crypto.randomUUID()}.png`;
      const { error: uploadError } = await supabase.storage.from("event-photos").upload(path, blob, { contentType: "image/png", cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
      onChange(data.publicUrl); setSource(null);
    } catch { setError("No hemos podido subir la foto. Vuelve a intentarlo."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl border p-3">
    <label className="block space-y-2"><span className="text-xs font-medium">Foto de la cabeza</span><Input type="file" accept="image/*" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) { setSource(URL.createObjectURL(file)); setAdjust({ zoom: 1, x: 0, y: 0 }); setError(""); } event.target.value = ""; }} /></label>
    {source && <div className="space-y-3"><p className="text-xs text-muted-foreground">Ajusta la cara dentro del círculo.</p><canvas ref={canvas} width={720} height={720} className="mx-auto h-48 w-48 rounded-full bg-muted" />
      {([['zoom', 'Zoom', 1, 3, .05], ['x', 'Mover horizontal', -50, 50, 1], ['y', 'Mover vertical', -50, 50, 1]] as const).map(([key, label, min, max, step]) => <label key={key} className="block text-xs">{label}<Input type="range" min={min} max={max} step={step} value={adjust[key]} disabled={busy} onChange={event => setAdjust(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
      <div className="flex gap-2"><Button type="button" onClick={save} disabled={busy || !ready}>{busy ? "Subiendo…" : "Aplicar foto"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setSource(null)}>Cancelar</Button></div>
    </div>}
    {photoUrl && !source && <Button type="button" variant="outline" onClick={() => onChange(null)}>Quitar foto</Button>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
