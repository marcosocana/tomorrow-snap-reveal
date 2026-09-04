import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Copy, ImagePlus, Images, Sparkles } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type StepId = "event" | "style" | "contact";
type PhotoMode = "color" | "bw" | "both";
type CreatedDemo = { event: { id: string; name: string }; slug: string; eventUrl: string; maxStrips: number };

const steps: Array<{ id: StepId; label: string }> = [
  { id: "event", label: "Evento" },
  { id: "style", label: "Diseño" },
  { id: "contact", label: "Contacto" },
];

const NewPhotostripDemo = () => {
  const { toast } = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedDemo | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [form, setForm] = useState({
    eventName: "",
    stripFooterText: "",
    photoMode: "both" as PhotoMode,
    coverImage: null as File | null,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    password: "",
    passwordConfirm: "",
  });

  const currentStep = steps[stepIndex];
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid", []);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || "";
      if (email) setForm((current) => ({ ...current, contactEmail: current.contactEmail || email }));
    });
  }, []);

  useEffect(() => () => {
    if (coverPreview.startsWith("blob:")) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const fail = (description: string) => {
    toast({ title: "Revisa este paso", description, variant: "destructive" });
    return false;
  };

  const validate = (step: StepId) => {
    if (step === "event" && !form.eventName.trim()) return fail("Escribe el nombre del evento.");
    if (step === "style" && form.coverImage && (form.coverImage.size > 5_242_880 || !["image/png", "image/jpeg", "image/webp"].includes(form.coverImage.type))) {
      return fail("La portada debe ser PNG, JPG o WebP y pesar menos de 5 MB.");
    }
    if (step === "contact") {
      if (!form.contactName.trim() || !form.contactPhone.trim()) return fail("Completa tu nombre y teléfono.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return fail("Introduce un email válido.");
      if (form.password.length < 8) return fail("La contraseña debe tener al menos 8 caracteres.");
      if (form.password !== form.passwordConfirm) return fail("Las contraseñas no coinciden.");
    }
    return true;
  };

  const isComplete = (step: StepId) => {
    if (step === "event") return Boolean(form.eventName.trim());
    if (step === "style") return Boolean(form.photoMode);
    return Boolean(
      form.contactName.trim() && form.contactPhone.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim()) &&
      form.password.length >= 8 && form.password === form.passwordConfirm,
    );
  };

  const uploadCover = async () => {
    if (!form.coverImage) return null;
    const extension = (form.coverImage.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
    const path = `event-images/photostrip-demo-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("event-photos").upload(path, form.coverImage, { contentType: form.coverImage.type });
    if (error) throw error;
    return supabase.storage.from("event-photos").getPublicUrl(path).data.publicUrl;
  };

  const submit = async () => {
    if (!validate("contact")) return;
    setSubmitting(true);
    try {
      const coverImageUrl = await uploadCover();
      const email = form.contactEmail.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke("create-photostrip-demo", {
        body: {
          contactName: form.contactName.trim(),
          contactEmail: email,
          contactPhone: form.contactPhone.trim(),
          password: form.password,
          eventName: form.eventName.trim(),
          stripFooterText: form.stripFooterText.trim() || null,
          photoMode: form.photoMode,
          coverImageUrl,
          timezone,
        },
      });
      let errorCode = data?.error || "";
      const response = (error as { context?: Response } | null)?.context;
      if (!errorCode && response) {
        try { errorCode = (await response.clone().json() as { error?: string }).error || ""; } catch { /* SDK message below */ }
      }
      if (error || errorCode || !data?.eventUrl) throw new Error(errorCode || error?.message || "CREATE_FAILED");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: form.password });
      if (signInError) console.warn("Photostrip demo created; automatic sign-in failed:", signInError.message);
      setCreated(data as CreatedDemo);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      toast({
        title: code.includes("INVALID_CREDENTIALS") ? "Este usuario ya existe" : "No se pudo crear la demo",
        description: code.includes("INVALID_CREDENTIALS")
          ? <span>La contraseña no es correcta. Inténtalo de nuevo o <a href="/reset-password" className="font-semibold underline underline-offset-2">recupera tu contraseña</a>.</span>
          : "Comprueba los datos y vuelve a intentarlo.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyUrl = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.eventUrl);
    toast({ title: "Enlace copiado" });
  };

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg || !created) return;
    const source = new XMLSerializer().serializeToString(svg);
    const objectUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${created.slug}-qr.svg`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  if (created) {
    return (
      <main className="min-h-screen bg-[#f7f1e5] px-4 py-8 text-[#241c18]">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center">
            <img src="/LogoTransparent.png" alt="Revelao" className="mx-auto h-10 w-auto" />
            <span className="mx-auto mt-8 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-700"><Check /></span>
            <h1 className="mt-4 text-3xl font-bold">Tu Photostrip demo está listo</h1>
            <p className="mt-2 text-muted-foreground">Puedes crear hasta 3 tiras y verlas juntas en la galería.</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-center text-2xl font-semibold">{created.event.name}</h2>
            <div ref={qrRef} className="mx-auto my-6 w-fit rounded-xl bg-white p-3"><QRCodeSVG value={created.eventUrl} size={220} level="H" includeMargin /></div>
            <p className="break-all rounded-lg bg-muted p-3 text-center text-sm">{created.eventUrl}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button variant="outline" onClick={() => void copyUrl()}><Copy className="mr-2 h-4 w-4" />Copiar enlace</Button>
              <Button variant="outline" onClick={downloadQr}>Descargar QR</Button>
              <Button asChild variant="outline" className="sm:col-span-2"><a href={`/admin/photostrip/${created.event.id}/edit`}>Editar evento</a></Button>
              <Button asChild className="sm:col-span-2 bg-[#f06a5f] text-white hover:bg-[#f06a5f]/90"><a href={created.eventUrl}><Camera className="mr-2 h-4 w-4" />Entrar y hacer la primera tira</a></Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const renderStep = () => {
    if (currentStep.id === "event") return (
      <div className="space-y-6">
        <div className="space-y-2"><Label htmlFor="eventName">¿Cómo se llama el evento?</Label><Input id="eventName" autoFocus maxLength={200} value={form.eventName} onChange={(event) => update("eventName", event.target.value)} placeholder="Ej: Boda Laura y Miguel" className="h-12 rounded-full px-4" /></div>
        <div className="space-y-2"><Label htmlFor="footer">Texto al pie de la tira (opcional)</Label><Textarea id="footer" maxLength={120} value={form.stripFooterText} onChange={(event) => update("stripFooterText", event.target.value)} placeholder="La noche que no olvidaremos" className="rounded-2xl" /></div>
        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-[#fffaf0] p-4 text-center text-xs font-medium sm:text-sm"><span><Camera className="mx-auto mb-2 h-5 w-5 text-[#f06a5f]" />4 fotos</span><span><Sparkles className="mx-auto mb-2 h-5 w-5 text-[#f06a5f]" />3 tiras demo</span><span><Images className="mx-auto mb-2 h-5 w-5 text-[#f06a5f]" />Galería común</span></div>
      </div>
    );
    if (currentStep.id === "style") return (
      <div className="space-y-6">
        <div className="space-y-3"><Label>Acabado disponible</Label><div className="grid gap-3 sm:grid-cols-3">{(["both", "color", "bw"] as PhotoMode[]).map((mode) => <button key={mode} type="button" onClick={() => update("photoMode", mode)} className={`rounded-xl border p-4 text-left ${form.photoMode === mode ? "border-[#f06a5f] bg-[#f06a5f]/10" : "bg-background"}`}><span className="font-semibold">{mode === "both" ? "A elegir" : mode === "color" ? "Color" : "Blanco y negro"}</span><span className="mt-1 block text-xs text-muted-foreground">{mode === "both" ? "Cada invitado decide" : "Mismo acabado para todos"}</span></button>)}</div></div>
        <div className="space-y-2"><Label>Foto de los novios como portada (opcional)</Label>{coverPreview ? <img src={coverPreview} alt="Vista previa de la portada" className="aspect-video w-full rounded-xl border object-cover" /> : null}<label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-4 text-center text-sm"><ImagePlus className="mb-2 h-6 w-6 text-[#f06a5f]" />{form.coverImage?.name || "Subir foto de portada"}<span className="mt-1 text-xs text-muted-foreground">PNG, JPG o WebP · máximo 5 MB</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] || null; update("coverImage", file); if (file) setCoverPreview(URL.createObjectURL(file)); }} /></label></div>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-4"><img src="/LogoMiniRevelao.svg" alt="Logo de Revelao" className="h-12 w-16 object-contain" /><div><p className="font-medium">Logo Revelao incluido</p><p className="text-sm text-muted-foreground">Aparecerá automáticamente en la portada y en las tiras.</p></div></div>
      </div>
    );
    return (
      <div className="space-y-5">
        <div className="space-y-2"><Label htmlFor="contactName">Tu nombre</Label><Input id="contactName" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} className="h-12 rounded-full px-4" /></div>
        <div className="space-y-2"><Label htmlFor="contactEmail">Email</Label><Input id="contactEmail" type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} className="h-12 rounded-full px-4" autoComplete="email" /></div>
        <div className="space-y-2"><Label htmlFor="contactPhone">Teléfono</Label><Input id="contactPhone" type="tel" value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} className="h-12 rounded-full px-4" autoComplete="tel" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" minLength={8} value={form.password} onChange={(event) => update("password", event.target.value)} className="h-12 rounded-full px-4" autoComplete="new-password" /><p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p></div><div className="space-y-2"><Label htmlFor="passwordConfirm">Repetir contraseña</Label><Input id="passwordConfirm" type="password" minLength={8} value={form.passwordConfirm} onChange={(event) => update("passwordConfirm", event.target.value)} className="h-12 rounded-full px-4" autoComplete="new-password" /></div></div>
      </div>
    );
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6 lg:py-8">
        <header className="mb-5 space-y-3"><img src="/LogoTransparent.png" alt="Revelao" className="h-8 w-auto" /><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-[#f06a5f]">Photostrip demo</p><h1 className="text-2xl font-bold sm:text-3xl">Crea tu fotomatón de prueba</h1><p className="mt-1 text-sm text-muted-foreground">Tres tiras gratis para probar toda la experiencia.</p></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#f06a5f] transition-all" style={{ width: `${progress}%` }} /></div></header>
        <form className="flex flex-1 flex-col pb-24 sm:pb-0" onSubmit={(event) => { event.preventDefault(); if (stepIndex === steps.length - 1) void submit(); else if (validate(currentStep.id)) setStepIndex((value) => value + 1); }}>
          <section className="flex-1 rounded-xl border bg-card p-4 shadow-sm sm:p-6"><p className="mb-5 text-xs font-semibold uppercase text-muted-foreground">{currentStep.label}</p>{renderStep()}</section>
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mt-5 sm:border-0 sm:bg-transparent sm:px-0"><div className="mx-auto flex max-w-3xl gap-3"><Button type="button" variant="outline" className="h-12 rounded-full" disabled={stepIndex === 0 || submitting} onClick={() => setStepIndex((value) => Math.max(0, value - 1))}><ArrowLeft className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Atrás</span></Button><Button type="submit" className="h-12 flex-1 rounded-full bg-[#f06a5f] text-white hover:bg-[#f06a5f]/90" disabled={!isComplete(currentStep.id) || submitting}>{stepIndex === steps.length - 1 ? <><Check className="mr-2 h-4 w-4" />{submitting ? "Creando..." : "Crear Photostrip demo"}</> : <>Continuar<ArrowRight className="ml-2 h-4 w-4" /></>}</Button></div></div>
        </form>
      </div>
    </main>
  );
};

export default NewPhotostripDemo;
