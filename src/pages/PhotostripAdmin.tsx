import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, Eye, EyeOff, ExternalLink, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { photostripApi, downloadPhotostrip, type PublicPhotostripEvent } from "@/lib/photostrip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ManagedEvent = {
  id: string;
  name: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  timezone: string;
  owner_id: string | null;
};

type Config = {
  event_id: string;
  slug: string;
  enabled: boolean;
  photo_mode: "color" | "bw" | "both";
  gallery_visibility: "public" | "participants" | "admin_only";
  strip_display_name: string | null;
  strip_footer_text: string | null;
  logo_path: string | null;
  logo_url: string | null;
  gallery_views: number;
};

type AdminParticipation = {
  id: string;
  guestLabel: string;
  status: string;
  mode: "color" | "bw";
  isVisible: boolean;
  downloads: number;
  createdAt: string;
  completedAt: string | null;
  removed: boolean;
  thumbnailUrl: string | null;
  stripUrl: string | null;
};
type AdminMetrics = { participations: number; completed: number; incomplete: number; downloads: number; latest: string | null };

const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const toLocalInput = (value: string | null, timezone: string) => value ? formatInTimeZone(new Date(value), timezone, "yyyy-MM-dd'T'HH:mm") : "";
const publicUrl = (slug: string) => `${window.location.origin}/photostrip/${slug}`;
const DEFAULT_PHOTOSTRIP_LOGO_URL = "https://acceso.revelao.cam/LogoMiniRevelao.svg";

const AdminHeader = ({ title }: { title: string }) => (
  <header className="border-b border-border bg-background">
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
      <Button asChild variant="ghost" size="icon"><Link to="/event-management" aria-label="Volver"><ArrowLeft /></Link></Button>
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Photostrip by Revelao</p><h1 className="text-xl font-semibold">{title}</h1></div>
    </div>
  </header>
);

export const PhotostripAdminForm = ({ edit = false }: { edit?: boolean }) => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(edit);
  const [logo, setLogo] = useState<File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [form, setForm] = useState({
    name: "", slug: "", startsAt: "", endsAt: "", timezone: "Europe/Madrid", enabled: true,
    photoMode: "both" as Config["photo_mode"], galleryVisibility: "participants" as Config["gallery_visibility"],
    stripDisplayName: "", stripFooterText: "", logoUrl: DEFAULT_PHOTOSTRIP_LOGO_URL,
  });

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin-login"); return; }
      if (!edit || !eventId) { setLoading(false); return; }
      const { data: event, error: eventError } = await supabase.from("events").select("id,name,upload_start_time,upload_end_time,timezone,background_image_url").eq("id", eventId).single();
      const { data: config, error: configError } = await supabase.from("photostrip_event_configs").select("*").eq("event_id", eventId).single();
      if (eventError || configError || !event || !config) {
        toast({ title: "No se pudo abrir el evento", variant: "destructive" }); navigate("/event-management"); return;
      }
      const savedConfig = config as Config;
      setForm({
        name: event.name, slug: savedConfig.slug, startsAt: toLocalInput(event.upload_start_time, event.timezone || "Europe/Madrid"), endsAt: toLocalInput(event.upload_end_time, event.timezone || "Europe/Madrid"),
        timezone: event.timezone || "Europe/Madrid", enabled: savedConfig.enabled, photoMode: savedConfig.photo_mode,
        galleryVisibility: savedConfig.gallery_visibility, stripDisplayName: savedConfig.strip_display_name || "",
        stripFooterText: savedConfig.strip_footer_text || "", logoUrl: savedConfig.logo_url || DEFAULT_PHOTOSTRIP_LOGO_URL,
      });
      setBackgroundPreview(event.background_image_url || "");
      setLoading(false);
    })();
  }, [edit, eventId, navigate, toast]);

  useEffect(() => () => {
    if (backgroundPreview.startsWith("blob:")) URL.revokeObjectURL(backgroundPreview);
  }, [backgroundPreview]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const startsAt = fromZonedTime(`${form.startsAt}:00`, form.timezone);
    const endsAt = fromZonedTime(`${form.endsAt}:00`, form.timezone);
    if (!form.name.trim() || !form.slug || !form.startsAt || !form.endsAt || endsAt <= startsAt) {
      toast({ title: "Revisa nombre, URL y fechas", description: "La fecha final debe ser posterior al inicio.", variant: "destructive" }); return;
    }
    setSaving(true);
    let createdId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("UNAUTHORIZED");
      let targetId = eventId;
      const eventValues = {
        name: form.name.trim(), upload_start_time: startsAt.toISOString(), upload_end_time: endsAt.toISOString(),
        reveal_time: endsAt.toISOString(), timezone: form.timezone, type: "photostrip", plan_id: "photostrip",
        is_demo: false, max_photos: 0, allow_video_recording: false, allow_audio_recording: false,
        ...(!backgroundImage ? { background_image_url: backgroundPreview || null } : {}),
      };
      if (edit && eventId) {
        const { error } = await supabase.from("events").update(eventValues).eq("id", eventId); if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert({ ...eventValues, owner_id: user.id, password_hash: `photostrip-${crypto.randomUUID()}` }).select("id").single();
        if (error || !data) throw error || new Error("CREATE_FAILED");
        targetId = data.id; createdId = data.id;
      }
      if (!targetId) throw new Error("MISSING_EVENT");
      if (backgroundImage) {
        if (backgroundImage.size > 5_242_880 || !["image/png", "image/jpeg", "image/webp"].includes(backgroundImage.type)) throw new Error("La portada debe ser PNG, JPG o WebP y pesar menos de 5 MB.");
        const extension = (backgroundImage.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
        const backgroundPath = `event-images/photostrip-${targetId}-${crypto.randomUUID()}.${extension}`;
        const { error: backgroundError } = await supabase.storage.from("event-photos").upload(backgroundPath, backgroundImage, { contentType: backgroundImage.type });
        if (backgroundError) throw backgroundError;
        const backgroundUrl = supabase.storage.from("event-photos").getPublicUrl(backgroundPath).data.publicUrl;
        const { error: backgroundUpdateError } = await supabase.from("events").update({ background_image_url: backgroundUrl }).eq("id", targetId);
        if (backgroundUpdateError) throw backgroundUpdateError;
      }
      let logoPath: string | undefined;
      if (logo) {
        if (logo.size > 5_242_880 || !["image/png", "image/jpeg", "image/webp"].includes(logo.type)) throw new Error("El logo debe ser PNG, JPG o WebP y pesar menos de 5 MB.");
        const extension = (logo.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").toLowerCase();
        logoPath = `${targetId}/branding/logo.${extension}`;
        const { error } = await supabase.storage.from("photostrips").upload(logoPath, logo, { upsert: true, contentType: logo.type });
        if (error) throw error;
      }
      const configValues = {
        slug: form.slug, enabled: form.enabled, photo_count: 4, countdown_seconds: 3, photo_mode: form.photoMode,
        gallery_visibility: form.galleryVisibility, strip_template: "classic", strip_display_name: form.stripDisplayName.trim() || null,
        strip_footer_text: form.stripFooterText.trim() || null, logo_url: form.logoUrl.trim() || DEFAULT_PHOTOSTRIP_LOGO_URL,
        ...(logoPath ? { logo_path: logoPath } : {}),
      };
      const query = supabase.from("photostrip_event_configs");
      const { error: configError } = edit ? await query.update(configValues).eq("event_id", targetId) : await query.insert({ event_id: targetId, ...configValues });
      if (configError) throw configError;
      toast({ title: edit ? "Photostrip actualizado" : "Photostrip creado" });
      navigate(`/admin/photostrip/${targetId}`);
    } catch (saveError) {
      if (createdId) await supabase.from("events").delete().eq("id", createdId);
      const message = saveError instanceof Error ? saveError.message : "Error desconocido";
      toast({ title: "No se pudo guardar", description: message.includes("duplicate") ? "Esa URL ya está en uso." : message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center">Cargando Photostrip…</div>;
  return <div className="min-h-screen overflow-x-hidden bg-muted/20"><AdminHeader title={edit ? "Editar evento" : "Nuevo evento"} />
    <main className="mx-auto max-w-3xl p-4 py-8"><form onSubmit={save}><Card className="space-y-6 p-5 md:p-7">
      <div><h2 className="text-lg font-semibold">Datos del evento</h2><p className="text-sm text-muted-foreground">Configura el fotomatón móvil y su galería.</p></div>
      <label className="block space-y-2 text-sm font-medium">Nombre<Input required maxLength={200} value={form.name} onChange={(e) => { update("name", e.target.value); if (!slugTouched) update("slug", slugify(e.target.value)); }} /></label>
      <label className="block min-w-0 space-y-2 text-sm font-medium">URL pública<div className="flex min-w-0 items-center rounded-md border bg-background"><span className="shrink-0 pl-3 text-xs text-muted-foreground">/photostrip/</span><Input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="min-w-0 border-0" value={form.slug} onChange={(e) => { setSlugTouched(true); update("slug", slugify(e.target.value)); }} /></div></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Inicio<Input required type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} /></label><label className="space-y-2 text-sm font-medium">Fin<Input required type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} /></label></div>
      <p className="-mt-4 text-xs text-muted-foreground">Zona horaria: {form.timezone}</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Acabado<select className="h-10 w-full rounded-md border bg-background px-3" value={form.photoMode} onChange={(e) => update("photoMode", e.target.value as Config["photo_mode"])}><option value="both">Color o B&amp;W</option><option value="color">Solo color</option><option value="bw">Solo B&amp;W</option></select></label><label className="space-y-2 text-sm font-medium">Galería<select className="h-10 w-full rounded-md border bg-background px-3" value={form.galleryVisibility} onChange={(e) => update("galleryVisibility", e.target.value as Config["gallery_visibility"])}><option value="public">Pública</option><option value="participants">Visible para participantes</option><option value="admin_only">Solo administración</option></select></label></div>
      <label className="block space-y-2 text-sm font-medium">Nombre impreso en la tira<Input maxLength={80} placeholder={form.name || "Nombre del evento"} value={form.stripDisplayName} onChange={(e) => update("stripDisplayName", e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">Texto del pie<Textarea maxLength={120} placeholder="La noche que no olvidaremos" value={form.stripFooterText} onChange={(e) => update("stripFooterText", e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">Foto de portada (opcional){backgroundPreview ? <img src={backgroundPreview} alt="Vista previa de la portada" className="aspect-video w-full rounded-md border object-cover" /> : null}<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const file = e.target.files?.[0] || null; setBackgroundImage(file); if (file) setBackgroundPreview(URL.createObjectURL(file)); }} /><span className="block text-xs font-normal text-muted-foreground">Puede ser una foto de los novios. PNG, JPG o WebP, máximo 5 MB.</span></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Logo personalizado (opcional)<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] || null)} /><span className="block text-xs font-normal text-muted-foreground">Se usa el logo de Revelao por defecto.</span></label><label className="space-y-2 text-sm font-medium">O URL externa del logo<Input type="url" placeholder="https://…" value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} /></label></div>
      <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={form.enabled} onChange={(e) => update("enabled", e.target.checked)} />Photostrip activo</label>
      <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button><Button disabled={saving}>{saving ? "Guardando…" : "Guardar Photostrip"}</Button></div>
    </Card></form></main></div>;
};

export const PhotostripAdminDetail = () => {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [event, setEvent] = useState<ManagedEvent | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [items, setItems] = useState<AdminParticipation[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [metrics, setMetrics] = useState<AdminMetrics>({ participations: 0, completed: 0, incomplete: 0, downloads: 0, latest: null });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextPage = 0, append = false) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { navigate("/admin-login"); return; }
    const { data: eventData, error: eventError } = await supabase.from("events").select("id,name,upload_start_time,upload_end_time,timezone,owner_id").eq("id", eventId).single();
    const { data: configData, error: configError } = await supabase.from("photostrip_event_configs").select("*").eq("event_id", eventId).single();
    if (eventError || configError || !eventData || !configData) { toast({ title: "Photostrip no encontrado", variant: "destructive" }); navigate("/event-management"); return; }
    setEvent(eventData as ManagedEvent); setConfig(configData as Config);
    try {
      const response = await photostripApi<{ event: PublicPhotostripEvent; participations: AdminParticipation[]; metrics: AdminMetrics; hasMore: boolean }>({ action: "admin-list", slug: configData.slug, page: nextPage, limit: 24 }, true);
      setItems((current) => append ? [...current, ...response.participations] : response.participations);
      setPage(nextPage); setHasMore(response.hasMore); setMetrics(response.metrics);
    } catch { toast({ title: "No se pudo cargar la galería", variant: "destructive" }); }
    setLoading(false);
  }, [eventId, navigate, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`photostrip-admin-${eventId}`).on("postgres_changes", { event: "*", schema: "public", table: "photostrip_participations", filter: `event_id=eq.${eventId}` }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [eventId, load]);

  const mutate = async (action: "admin-visibility" | "admin-delete", item: AdminParticipation) => {
    if (action === "admin-delete" && !window.confirm("¿Eliminar esta tira y sus cuatro fotos?")) return;
    try {
      await photostripApi({ action, slug: config?.slug, participationId: item.id, ...(action === "admin-visibility" ? { isVisible: !item.isVisible } : {}) }, true);
      await load();
    } catch { toast({ title: "No se pudo completar la acción", variant: "destructive" }); }
  };
  const copyUrl = async () => { if (!config) return; await navigator.clipboard.writeText(publicUrl(config.slug)); toast({ title: "Enlace copiado" }); };
  const downloadSvg = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg || !event) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${slugify(event.name)}-photostrip-qr.svg`; anchor.click(); URL.revokeObjectURL(url);
  };
  const downloadPng = () => {
    const svg = qrRef.current?.querySelector("svg"); if (!svg || !event) return;
    const source = new XMLSerializer().serializeToString(svg);
    const image = new Image(); const objectUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 900;
      const context = canvas.getContext("2d"); if (!context) { URL.revokeObjectURL(objectUrl); return; }
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, 900, 900); context.drawImage(image, 0, 0, 900, 900);
      const anchor = document.createElement("a"); anchor.href = canvas.toDataURL("image/png"); anchor.download = `${slugify(event.name)}-photostrip-qr.png`; anchor.click(); URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  };

  if (loading || !event || !config) return <div className="p-8 text-center">Cargando Photostrip…</div>;
  const url = publicUrl(config.slug);
  const now = Date.now();
  const eventStatus = !config.enabled ? "Pausado" : event.upload_start_time && now < new Date(event.upload_start_time).getTime() ? "Próximo" : event.upload_end_time && now > new Date(event.upload_end_time).getTime() ? "Finalizado" : "Activo";
  return <div className="min-h-screen overflow-x-hidden bg-muted/20"><AdminHeader title={event.name} /><main className="mx-auto max-w-6xl space-y-6 p-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">{eventStatus} · /photostrip/{config.slug}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => navigate(`/admin/photostrip/${event.id}/edit`)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir</a></Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">{[["Participaciones", metrics.participations], ["Tiras creadas", metrics.completed], ["Incompletas", metrics.incomplete], ["Descargas", metrics.downloads], ["Visitas galería", config.gallery_views], ["Última participación", metrics.latest ? new Date(metrics.latest).toLocaleDateString("es-ES") : "—"]].map(([label, value]) => <Card key={label} className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></Card>)}</div>
    <Card className="grid gap-6 p-5 md:grid-cols-[180px_1fr] md:p-7"><div ref={qrRef} className="w-fit rounded-lg bg-white p-3"><QRCodeSVG value={url} size={150} level="H" includeMargin /></div><div className="space-y-4"><div><h2 className="font-semibold">Acceso del evento</h2><p className="break-all text-sm text-muted-foreground">{url}</p><p className="mt-2 text-sm text-muted-foreground">{event.upload_start_time ? formatInTimeZone(new Date(event.upload_start_time), event.timezone, "dd/MM/yyyy HH:mm") : "—"} – {event.upload_end_time ? formatInTimeZone(new Date(event.upload_end_time), event.timezone, "dd/MM/yyyy HH:mm") : "—"} · {event.timezone}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyUrl()}><Copy className="mr-2 h-4 w-4" />Copiar URL</Button><Button variant="outline" onClick={downloadPng}><Download className="mr-2 h-4 w-4" />QR PNG</Button><Button variant="outline" onClick={downloadSvg}><Download className="mr-2 h-4 w-4" />QR SVG</Button></div></div></Card>
    <section><div className="mb-4 flex items-end justify-between"><div><h2 className="text-xl font-semibold">Galería y moderación</h2><p className="text-sm text-muted-foreground">Se actualiza en tiempo real.</p></div><Button variant="outline" size="sm" onClick={() => void load()}>Actualizar</Button></div>
      {items.length === 0 ? <Card className="p-10 text-center text-muted-foreground"><ImageIcon className="mx-auto mb-3" />Todavía no hay participaciones.</Card> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <Card key={item.id} className={`overflow-hidden ${item.removed ? "opacity-55" : ""}`}><div className="aspect-[1/1.8] bg-muted">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={`Tira de ${item.guestLabel}`} className="h-full w-full object-contain" loading="lazy" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">{item.removed ? "Eliminada" : item.status}</div>}</div><div className="space-y-3 p-4"><div className="flex justify-between"><div><p className="font-medium">{item.guestLabel}</p><p className="text-xs text-muted-foreground">{item.completedAt ? new Date(item.completedAt).toLocaleString("es-ES") : item.status}</p></div><span className="text-xs uppercase">{item.mode}</span></div>{!item.removed ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void mutate("admin-visibility", item)}>{item.isVisible ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}{item.isVisible ? "Ocultar" : "Mostrar"}</Button>{item.stripUrl ? <Button size="sm" variant="outline" onClick={() => void downloadPhotostrip(item.stripUrl!, config.slug)}><Download className="h-4 w-4" /></Button> : null}<Button size="sm" variant="destructive" onClick={() => void mutate("admin-delete", item)}><Trash2 className="h-4 w-4" /></Button></div> : null}</div></Card>)}</div>}
      {hasMore ? <div className="mt-5 text-center"><Button variant="outline" onClick={() => void load(page + 1, true)}>Cargar más</Button></div> : null}
    </section>
  </main></div>;
};

export const PhotostripDashboardSection = ({ events }: { events: Array<{ id: string; name: string; upload_start_time: string | null; upload_end_time: string | null }> }) => (
  events.length ? <div className="grid gap-4 md:grid-cols-2">{events.map((event) => <Card key={event.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#dc6258]">Photostrip</p><h3 className="mt-1 text-lg font-semibold">{event.name}</h3><p className="mt-2 text-sm text-muted-foreground">{event.upload_start_time ? new Date(event.upload_start_time).toLocaleString("es-ES") : "Sin fecha"}</p></div><Button asChild size="sm"><Link to={`/admin/photostrip/${event.id}`}>Gestionar</Link></Button></div></Card>)}</div> : <Card className="p-12 text-center"><ImageIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" /><p className="font-medium">Todavía no tienes ningún Photostrip</p><p className="mt-1 text-sm text-muted-foreground">Crea tu primer fotomatón móvil.</p><Button asChild className="mt-5"><Link to="/admin/photostrip/new">Crear Photostrip</Link></Button></Card>
);
