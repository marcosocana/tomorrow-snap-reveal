import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, Copy, Download, ExternalLink, Eye, EyeOff, Lock, Pencil, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { carreteoApi, downloadCarreteoPhoto, type PublicCarreteoEvent } from "@/lib/carreteo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CarreteoPricingDialog } from "@/components/carreteo/CarreteoPricingDialog";

type ManagedEvent = {
  id: string;
  name: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  reveal_time: string;
  timezone: string;
  owner_id: string | null;
  plan_id?: string | null;
};

type Config = {
  event_id: string;
  slug: string;
  enabled: boolean;
  shots_per_camera: number;
  max_cameras: number | null;
  gallery_views: number;
};

type AdminPhoto = {
  id: string;
  cameraLabel: string;
  frameNumber: number;
  isVisible: boolean;
  removed: boolean;
  takenAt: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};
type AdminMetrics = { cameras: number; finishedRolls: number; photos: number; latest: string | null; galleryViews: number };

const ADMIN_EMAIL = "revelao.cam@gmail.com";
const PAID_SHOTS_PER_CAMERA = 25;
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const toLocalInput = (value: string | null, timezone: string) => value ? formatInTimeZone(new Date(value), timezone, "yyyy-MM-dd'T'HH:mm") : "";
const publicUrl = (slug: string) => `${window.location.origin}/carreteo/${slug}`;
const formatDate = (value: string | null, timezone: string) => value ? formatInTimeZone(new Date(value), timezone, "dd/MM/yyyy HH:mm") : "—";

const AdminHeader = ({ title }: { title: string }) => (
  <header className="border-b border-border bg-background">
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
      <Button asChild variant="ghost" size="icon"><Link to="/event-management?product=carreteo" aria-label="Volver"><ArrowLeft /></Link></Button>
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Carreteo by Revelao</p><h1 className="text-xl font-semibold">{title}</h1></div>
    </div>
  </header>
);

export const CarreteoAdminForm = ({ edit = false }: { edit?: boolean }) => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redeemToken = edit ? null : searchParams.get("redeem")?.trim().toUpperCase() || null;
  const { toast } = useToast();
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(edit);
  const [hasShots, setHasShots] = useState(false);
  // Los eventos comprados traen 25 fotos por cámara fijas; solo el superadmin elige.
  const [paidPlan, setPaidPlan] = useState(Boolean(redeemToken));
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [form, setForm] = useState({
    name: "", slug: "", startsAt: "", endsAt: "", revealAt: "", timezone: "Europe/Madrid", enabled: true, shotsPerCamera: PAID_SHOTS_PER_CAMERA,
  });

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin-login"); return; }
      if (!edit && !redeemToken && user.email?.toLowerCase() !== ADMIN_EMAIL) {
        toast({ title: "Elige un plan para crear tu Carreteo" });
        navigate("/event-management?product=carreteo");
        return;
      }
      if (!edit || !eventId) { setLoading(false); return; }
      const { data: event, error: eventError } = await supabase.from("events").select("id,name,upload_start_time,upload_end_time,reveal_time,timezone,background_image_url,plan_id").eq("id", eventId).single();
      const { data: config, error: configError } = await supabase.from("carreteo_event_configs").select("*").eq("event_id", eventId).single();
      if (eventError || configError || !event || !config) {
        toast({ title: "No se pudo abrir el evento", variant: "destructive" }); navigate("/event-management?product=carreteo"); return;
      }
      const { count } = await supabase.from("carreteo_photos").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      const timezone = event.timezone || "Europe/Madrid";
      setForm({
        name: event.name, slug: config.slug, startsAt: toLocalInput(event.upload_start_time, timezone), endsAt: toLocalInput(event.upload_end_time, timezone),
        revealAt: toLocalInput(event.reveal_time, timezone), timezone, enabled: config.enabled, shotsPerCamera: config.shots_per_camera,
      });
      setHasShots(Boolean(count));
      setPaidPlan(Boolean(event.plan_id?.startsWith("carreteo_")));
      setBackgroundPreview(event.background_image_url || "");
      setLoading(false);
    })();
  }, [edit, eventId, navigate, redeemToken, toast]);

  useEffect(() => () => {
    if (backgroundPreview.startsWith("blob:")) URL.revokeObjectURL(backgroundPreview);
  }, [backgroundPreview]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    if (!form.name.trim() || !form.slug || !form.startsAt || !form.endsAt || !form.revealAt) {
      toast({ title: "Revisa nombre, URL y fechas", variant: "destructive" }); return;
    }
    const startsAt = fromZonedTime(`${form.startsAt}:00`, form.timezone);
    const endsAt = fromZonedTime(`${form.endsAt}:00`, form.timezone);
    const revealAt = fromZonedTime(`${form.revealAt}:00`, form.timezone);
    if (endsAt <= startsAt) {
      toast({ title: "Revisa las fechas", description: "El cierre debe ser posterior a la apertura.", variant: "destructive" }); return;
    }
    if (revealAt < endsAt) {
      toast({ title: "Revisa la fecha de revelado", description: "Las fotos se revelan cuando el carrete ya está cerrado.", variant: "destructive" }); return;
    }
    const shotsPerCamera = Math.floor(Number(form.shotsPerCamera));
    if (!Number.isFinite(shotsPerCamera) || shotsPerCamera < 1 || shotsPerCamera > 99) {
      toast({ title: "Fotos por cámara entre 1 y 99", variant: "destructive" }); return;
    }
    setSaving(true);
    let createdId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("UNAUTHORIZED");
      let targetId = eventId;
      let createdWithPurchase = false;
      const eventValues = {
        name: form.name.trim(), upload_start_time: startsAt.toISOString(), upload_end_time: endsAt.toISOString(),
        reveal_time: revealAt.toISOString(), timezone: form.timezone, type: "carreteo",
        is_demo: false, max_photos: 0, allow_video_recording: false, allow_audio_recording: false,
        ...(!backgroundImage ? { background_image_url: backgroundPreview || null } : {}),
      };
      const configValues = { slug: form.slug, enabled: form.enabled, shots_per_camera: shotsPerCamera };
      if (edit && eventId) {
        const { error } = await supabase.from("events").update(eventValues).eq("id", eventId); if (error) throw error;
      } else if (redeemToken) {
        const { data, error } = await supabase.functions.invoke("redeem-create-carreteo", {
          body: { token: redeemToken, event: eventValues, config: configValues },
        });
        if (error || !data?.eventId) throw error || new Error("PURCHASE_REDEEM_FAILED");
        targetId = data.eventId;
        createdWithPurchase = true;
      } else {
        const { data, error } = await supabase.from("events").insert({ ...eventValues, plan_id: "carreteo", owner_id: user.id, password_hash: `carreteo-${crypto.randomUUID()}` }).select("id").single();
        if (error || !data) throw error || new Error("CREATE_FAILED");
        targetId = data.id; createdId = data.id;
      }
      if (!targetId) throw new Error("MISSING_EVENT");
      if (backgroundImage) {
        if (backgroundImage.size > 5_242_880 || !["image/png", "image/jpeg", "image/webp"].includes(backgroundImage.type)) throw new Error("La portada debe ser PNG, JPG o WebP y pesar menos de 5 MB.");
        const extension = (backgroundImage.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
        const backgroundPath = `event-images/carreteo-${targetId}-${crypto.randomUUID()}.${extension}`;
        const { error: backgroundError } = await supabase.storage.from("event-photos").upload(backgroundPath, backgroundImage, { contentType: backgroundImage.type });
        if (backgroundError) throw backgroundError;
        const backgroundUrl = supabase.storage.from("event-photos").getPublicUrl(backgroundPath).data.publicUrl;
        const { error: backgroundUpdateError } = await supabase.from("events").update({ background_image_url: backgroundUrl }).eq("id", targetId);
        if (backgroundUpdateError) throw backgroundUpdateError;
      }
      if (!createdWithPurchase) {
        const query = supabase.from("carreteo_event_configs");
        const { error: configError } = edit
          ? await query.update(configValues).eq("event_id", targetId)
          : await query.insert({ event_id: targetId, ...configValues });
        if (configError) throw configError;
      }
      toast({ title: edit ? "Carreteo actualizado" : "Carreteo creado" });
      navigate(`/admin/carreteo/${targetId}`);
    } catch (saveError) {
      if (createdId) await supabase.from("events").delete().eq("id", createdId);
      const message = saveError instanceof Error ? saveError.message : "Error desconocido";
      toast({ title: "No se pudo guardar", description: message.includes("duplicate") ? "Esa URL ya está en uso." : message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center">Cargando Carreteo…</div>;
  return <div className="min-h-screen overflow-x-hidden bg-muted/20"><AdminHeader title={edit ? "Editar evento" : "Nuevo evento"} />
    <main className="mx-auto max-w-3xl p-4 py-8"><form onSubmit={save}><Card className="space-y-6 p-5 md:p-7">
      <div><h2 className="text-lg font-semibold">Datos del evento</h2><p className="text-sm text-muted-foreground">Cada invitado escanea el QR y recibe una cámara desechable con su propio carrete.</p></div>
      <label className="block space-y-2 text-sm font-medium">Nombre<Input required maxLength={200} value={form.name} onChange={(e) => { update("name", e.target.value); if (!slugTouched) update("slug", slugify(e.target.value)); }} /></label>
      <label className="block min-w-0 space-y-2 text-sm font-medium">URL pública<div className="flex min-w-0 items-center rounded-md border bg-background"><span className="shrink-0 pl-3 text-xs text-muted-foreground">/carreteo/</span><Input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="min-w-0 border-0" value={form.slug} onChange={(e) => { setSlugTouched(true); update("slug", slugify(e.target.value)); }} /></div></label>
      <label className="block space-y-2 text-sm font-medium">Fotos por cámara<Input required type="number" min={1} max={99} disabled={hasShots || paidPlan} value={form.shotsPerCamera} onChange={(e) => update("shotsPerCamera", Number(e.target.value))} /><span className="block text-xs font-normal text-muted-foreground">{paidPlan ? `Tu plan incluye ${PAID_SHOTS_PER_CAMERA} fotos por cámara.` : hasShots ? "Ya hay fotos hechas: el tamaño del carrete no se puede cambiar." : "Exposiciones del carrete de cada invitado."}</span></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Se abre el carrete<Input required type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></label><label className="space-y-2 text-sm font-medium">Se cierra el carrete<Input required type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></label></div>
      <label className="block space-y-2 text-sm font-medium">Revelado de las fotos<Input required type="datetime-local" value={form.revealAt} onChange={(e) => update("revealAt", e.target.value)} /><span className="block text-xs font-normal text-muted-foreground">Hasta entonces nadie ve las fotos. Después, el mismo QR abre la galería.</span></label>
      <p className="-mt-4 text-xs text-muted-foreground">Zona horaria: {form.timezone}</p>
      <label className="block space-y-2 text-sm font-medium">Foto de portada de la galería (opcional){backgroundPreview ? <img src={backgroundPreview} alt="Vista previa de la portada" className="aspect-video w-full rounded-md border object-cover" /> : null}<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; setBackgroundImage(file); if (file) setBackgroundPreview(URL.createObjectURL(file)); }} /><span className="block text-xs font-normal text-muted-foreground">PNG, JPG o WebP, máximo 5 MB.</span></label>
      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.enabled} onChange={(e) => update("enabled", e.target.checked)} />Carreteo activo</label>
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button><Button disabled={saving}>{saving ? "Guardando…" : "Guardar Carreteo"}</Button></div>
    </Card></form></main></div>;
};

export const CarreteoAdminDetail = () => {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [event, setEvent] = useState<ManagedEvent | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [items, setItems] = useState<AdminPhoto[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>({ cameras: 0, finishedRolls: 0, photos: 0, latest: null, galleryViews: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextPage = 0, append = false) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { navigate("/admin-login"); return; }
    const { data: eventData, error: eventError } = await supabase.from("events").select("id,name,upload_start_time,upload_end_time,reveal_time,timezone,owner_id,plan_id").eq("id", eventId).single();
    const { data: configData, error: configError } = await supabase.from("carreteo_event_configs").select("*").eq("event_id", eventId).single();
    if (eventError || configError || !eventData || !configData) { toast({ title: "Carreteo no encontrado", variant: "destructive" }); navigate("/event-management?product=carreteo"); return; }
    setEvent(eventData as ManagedEvent); setConfig(configData as Config);
    try {
      const response = await carreteoApi<{ event: PublicCarreteoEvent; photos: AdminPhoto[]; metrics: AdminMetrics; hasMore: boolean }>({ action: "admin-list", slug: configData.slug, page: nextPage, limit: 36 }, true);
      setItems((current) => append ? [...current, ...response.photos] : response.photos);
      setPage(nextPage); setHasMore(response.hasMore); setMetrics(response.metrics);
    } catch { toast({ title: "No se pudieron cargar las fotos", variant: "destructive" }); }
    setLoading(false);
  }, [eventId, navigate, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`carreteo-admin-${eventId}`).on("postgres_changes", { event: "*", schema: "public", table: "carreteo_photos", filter: `event_id=eq.${eventId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId, load]);

  const mutate = async (action: "admin-visibility" | "admin-delete", item: AdminPhoto) => {
    if (action === "admin-delete" && !window.confirm("¿Eliminar esta foto? No se puede deshacer.")) return;
    try {
      await carreteoApi({ action, slug: config?.slug, photoId: item.id, ...(action === "admin-visibility" ? { isVisible: !item.isVisible } : {}) }, true);
      await load();
    } catch { toast({ title: "No se pudo completar la acción", variant: "destructive" }); }
  };
  const copyUrl = async () => { if (!config) return; await navigator.clipboard.writeText(publicUrl(config.slug)); toast({ title: "Enlace copiado" }); };
  const downloadSvg = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg || !event) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${slugify(event.name)}-carreteo-qr.svg`; anchor.click(); URL.revokeObjectURL(url);
  };
  const downloadPng = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg || !event) return;
    const source = new XMLSerializer().serializeToString(svg);
    const image = new Image(); const objectUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 900;
      const context = canvas.getContext("2d"); if (!context) { URL.revokeObjectURL(objectUrl); return; }
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, 900, 900); context.drawImage(image, 0, 0, 900, 900);
      const anchor = document.createElement("a"); anchor.href = canvas.toDataURL("image/png"); anchor.download = `${slugify(event.name)}-carreteo-qr.png`; anchor.click(); URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  };

  if (loading || !event || !config) return <div className="p-8 text-center">Cargando Carreteo…</div>;
  const url = publicUrl(config.slug);
  const now = Date.now();
  const eventStatus = now >= new Date(event.reveal_time).getTime() ? "Revelado"
    : !config.enabled ? "Pausado"
      : event.upload_start_time && now < new Date(event.upload_start_time).getTime() ? "Próximo"
        : event.upload_end_time && now > new Date(event.upload_end_time).getTime() ? "Cerrado, pendiente de revelar" : "Activo";
  const cameraLimit = config.max_cameras ? `${metrics.cameras} / ${config.max_cameras}` : metrics.cameras;
  return <div className="min-h-screen overflow-x-hidden bg-muted/20"><AdminHeader title={event.name} /><main className="mx-auto max-w-6xl space-y-6 p-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{eventStatus} · /carreteo/{config.slug}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(`/admin/carreteo/${event.id}/edit`)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir</a></Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[["Cámaras", cameraLimit], ["Fotos", metrics.photos], ["Carretes completos", metrics.finishedRolls], ["Visitas galería", metrics.galleryViews], ["Última foto", metrics.latest ? new Date(metrics.latest).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" }) : "—"]].map(([label, value]) => <Card key={label} className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Card>)}</div>
    <Card className="grid gap-6 p-5 md:grid-cols-[180px_1fr] md:p-7"><div ref={qrRef} className="w-fit rounded-lg bg-white p-3"><QRCodeSVG value={url} size={150} level="H" includeMargin /></div><div className="space-y-4"><div><h2 className="font-semibold">Acceso del evento</h2><p className="break-all text-sm text-muted-foreground">{url}</p><p className="mt-2 text-sm text-muted-foreground">Carrete abierto: {formatDate(event.upload_start_time, event.timezone)} – {formatDate(event.upload_end_time, event.timezone)}</p><p className="text-sm text-muted-foreground">Revelado: {formatDate(event.reveal_time, event.timezone)} · {config.shots_per_camera} fotos por cámara · {event.timezone}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyUrl()}><Copy className="mr-2 h-4 w-4" />Copiar URL</Button><Button variant="outline" onClick={downloadPng}><Download className="mr-2 h-4 w-4" />QR PNG</Button><Button variant="outline" onClick={downloadSvg}><Download className="mr-2 h-4 w-4" />QR SVG</Button></div></div></Card>
    <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Fotos y moderación</h2><p className="text-sm text-muted-foreground">Solo tú las ves antes del revelado. Se actualiza en tiempo real.</p></div><Button variant="outline" size="sm" onClick={() => void load()}>Actualizar</Button></div>
      {items.length === 0 ? <Card className="p-10 text-center text-muted-foreground"><Camera className="mx-auto mb-3" />Todavía no hay fotos.</Card> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{items.map((item) => <Card key={item.id} className={`overflow-hidden ${item.removed ? "opacity-55" : ""}`}><div className="aspect-[4/3] bg-muted">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={`Foto ${item.frameNumber} de ${item.cameraLabel}`} className={`h-full w-full object-cover ${item.isVisible ? "" : "opacity-40"}`} loading="lazy" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">{item.removed ? "Eliminada" : "Sin imagen"}</div>}</div><div className="space-y-3 p-3"><div><p className="text-sm font-medium">{item.cameraLabel} · #{item.frameNumber}</p><p className="text-xs text-muted-foreground">{new Date(item.takenAt).toLocaleString("es-ES")}</p></div>{!item.removed ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void mutate("admin-visibility", item)} aria-label={item.isVisible ? "Ocultar" : "Mostrar"}>{item.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>{item.imageUrl ? <Button size="sm" variant="outline" aria-label="Descargar" onClick={() => void downloadCarreteoPhoto(item.imageUrl!, `carreteo-${config.slug}-${item.id.slice(0, 8)}.jpg`)}><Download className="h-4 w-4" /></Button> : null}<Button size="sm" variant="destructive" aria-label="Eliminar" onClick={() => void mutate("admin-delete", item)}><Trash2 className="h-4 w-4" /></Button></div> : null}</div></Card>)}</div>}
      {hasMore ? <div className="mt-5 text-center"><Button variant="outline" onClick={() => void load(page + 1, true)}>Cargar más</Button></div> : null}
    </section>
  </main></div>;
};

type CarreteoDashboardEvent = {
  id: string;
  name: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  reveal_time?: string | null;
  timezone?: string | null;
  created_at?: string | null;
  plan_id?: string | null;
  event_number?: number | null;
  owner_email?: string | null;
};

type CarreteoBulkActions = {
  selectedIds: Set<string>;
  onToggleSelection: (eventId: string) => void;
  onLockSelection: () => void | Promise<void>;
  onDeleteSelection: () => void | Promise<void>;
  isLocked: (eventId: string) => boolean;
};

const planCameraLimit = (planId?: string | null) =>
  planId === "carreteo_50" ? "50" : planId === "carreteo_150" ? "150" : planId === "carreteo_250" ? "250" : "Ilimitadas";

export const CarreteoDashboardSection = ({ events, bulkActions }: { events: CarreteoDashboardEvent[]; bulkActions?: CarreteoBulkActions }) => {
  const navigate = useNavigate();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setIsSuperAdmin((data.user?.email || "").toLowerCase() === ADMIN_EMAIL));
  }, []);

  const create = () => { if (isSuperAdmin) navigate("/admin/carreteo/new"); else setPricingOpen(true); };

  if (!events.length) return <><Card className="p-12 text-center"><Camera className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><p className="font-medium">Todavía no tienes ningún Carreteo</p><p className="mt-1 text-sm text-muted-foreground">Crea tu primera cámara desechable digital.</p><Button className="mt-5" onClick={create}>Crear Carreteo</Button></Card><CarreteoPricingDialog open={pricingOpen} onOpenChange={setPricingOpen} /></>;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3 border-b pb-3"><div><p className="text-sm font-semibold">Vista de eventos</p><p className="text-xs text-muted-foreground">Cámaras desechables creadas.</p></div><Button size="sm" onClick={create}>Crear Carreteo</Button></div>
      {bulkActions && bulkActions.selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">{bulkActions.selectedIds.size} seleccionados</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => void bulkActions.onLockSelection()}>
              <Lock className="h-4 w-4" /> Bloquear
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void bulkActions.onDeleteSelection()}>
              Eliminar selección
            </Button>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">{bulkActions ? <th className="w-10 py-3 pr-3 font-medium"> </th> : null}<th className="py-3 pr-4 font-medium">ID</th><th className="py-3 pr-4 font-medium">Evento</th><th className="py-3 pr-4 font-medium">Creación</th><th className="py-3 pr-4 font-medium">Email</th><th className="py-3 pr-4 font-medium">Estado</th><th className="py-3 pr-4 font-medium">Cámaras</th><th className="py-3 pr-4 font-medium">Apertura</th><th className="py-3 pr-4 font-medium">Cierre</th><th className="py-3 font-medium">Revelado</th></tr></thead>
          <tbody>{events.map((event) => {
            const now = Date.now();
            const timezone = event.timezone || "Europe/Madrid";
            const revealed = Boolean(event.reveal_time && new Date(event.reveal_time).getTime() <= now);
            const upcoming = Boolean(event.upload_start_time && new Date(event.upload_start_time).getTime() > now);
            const closed = Boolean(event.upload_end_time && new Date(event.upload_end_time).getTime() < now);
            const status = revealed ? "Revelado" : upcoming ? "Próximo" : closed ? "Pendiente de revelar" : "En curso";
            const open = () => navigate(`/admin/carreteo/${event.id}`);
            return <tr key={event.id} role="link" tabIndex={0} className="cursor-pointer border-b transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none last:border-0" onClick={open} onKeyDown={(keyboardEvent) => { if (keyboardEvent.key === "Enter") open(); }}>{bulkActions ? <td className="py-3 pr-3"><input type="checkbox" checked={bulkActions.selectedIds.has(event.id)} onChange={() => bulkActions.onToggleSelection(event.id)} onClick={(clickEvent) => clickEvent.stopPropagation()} onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()} aria-label={`Seleccionar ${event.name}`} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" /></td> : null}<td className="py-3 pr-4 text-muted-foreground">{event.event_number ?? "—"}</td><td className="py-3 pr-4 font-medium"><span className="inline-flex items-center gap-1.5">{bulkActions?.isLocked(event.id) ? <Lock className="h-3.5 w-3.5 text-foreground/80" /> : null}<span>{event.name}</span></span></td><td className="py-3 pr-4">{event.created_at ? new Date(event.created_at).toLocaleDateString("es-ES") : "—"}</td><td className="max-w-[190px] truncate py-3 pr-4">{event.owner_email || "—"}</td><td className="py-3 pr-4">{status}</td><td className="py-3 pr-4">{planCameraLimit(event.plan_id)}</td><td className="py-3 pr-4">{event.upload_start_time ? formatInTimeZone(new Date(event.upload_start_time), timezone, "dd/MM/yyyy HH:mm") : "—"}</td><td className="py-3 pr-4">{event.upload_end_time ? formatInTimeZone(new Date(event.upload_end_time), timezone, "dd/MM/yyyy HH:mm") : "—"}</td><td className="py-3">{event.reveal_time ? formatInTimeZone(new Date(event.reveal_time), timezone, "dd/MM/yyyy HH:mm") : "—"}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <CarreteoPricingDialog open={pricingOpen} onOpenChange={setPricingOpen} />
    </Card>
  );
};
