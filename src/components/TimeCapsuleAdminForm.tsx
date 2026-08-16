import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, Heart, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import {
  TIME_CAPSULE_MAX_VIDEO_SECONDS,
  TIME_CAPSULE_PLAN_ID,
  TIME_CAPSULE_YEAR_OPTIONS,
  addYears,
  getTimeCapsulePublicUrl,
  getTimeCapsuleSettings,
  withTimeCapsuleSettings,
} from "@/lib/timeCapsule";
import type { Json } from "@/integrations/supabase/types";

interface TimeCapsuleAdminFormProps {
  eventId?: string;
  pathPrefix: string;
  ownerEmail?: string;
  onOwnerEmailChange?: (value: string) => void;
  planSelector?: React.ReactNode;
}

const generatePassword = () => {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (n) => alphabet[n % alphabet.length]).join("");
};

const TIMEZONE = "Europe/Madrid";

const TimeCapsuleAdminForm = ({
  eventId,
  pathPrefix,
  ownerEmail = "",
  onOwnerEmailChange,
  planSelector,
}: TimeCapsuleAdminFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isEditing = !!eventId;
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [years, setYears] = useState<number>(5);
  const [password, setPassword] = useState(generatePassword);
  const [limitsJson, setLimitsJson] = useState<Json | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(eventId ?? null);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
      if (error || !data) {
        toast({ title: "Error", description: "No se pudo cargar la cápsula.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const settings = getTimeCapsuleSettings(data.limits_json as Json);
      setName(data.name);
      setDescription(data.description || "");
      setCoverUrl(data.custom_image_url || "");
      setPassword(data.password_hash);
      setYears(settings.years);
      setLimitsJson((data.limits_json as Json) ?? null);
      if (data.upload_start_time) {
        setWeddingDate(format(new Date(data.upload_start_time), "yyyy-MM-dd"));
      }
      setIsLoading(false);
    };
    load();
  }, [eventId, toast]);

  const openDate = useMemo(() => {
    if (!weddingDate) return null;
    const base = fromZonedTime(`${weddingDate}T12:00:00`, TIMEZONE);
    if (Number.isNaN(base.getTime())) return null;
    return addYears(base, years);
  }, [weddingDate, years]);

  const publicUrl = savedEventId ? getTimeCapsulePublicUrl(savedEventId) : null;

  const handleCoverUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const extension = file.name.split(".").pop() || "jpg";
      const filePath = `capsule-covers/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("event-photos").upload(filePath, file, {
        contentType: file.type || undefined,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(filePath);
      setCoverUrl(data.publicUrl);
    } catch (error) {
      console.error("Error uploading capsule cover:", error);
      toast({ title: "Error", description: "No se pudo subir la foto.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!name.trim() || !weddingDate || !openDate) {
      toast({
        title: "Faltan datos",
        description: "Indica el nombre de los novios y la fecha de la boda.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const uploadStart = fromZonedTime(`${weddingDate}T09:00:00`, TIMEZONE);
      const uploadEnd = new Date(uploadStart.getTime() + 36 * 60 * 60 * 1000);
      const expiry = new Date(openDate.getTime() + 90 * 24 * 60 * 60 * 1000);

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        custom_image_url: coverUrl || null,
        password_hash: password,
        admin_password: password,
        upload_start_time: uploadStart.toISOString(),
        upload_end_time: uploadEnd.toISOString(),
        reveal_time: openDate.toISOString(),
        hide_reveal_date: false,
        expiry_date: expiry.toISOString(),
        max_photos: 0,
        allow_video_recording: true,
        max_videos: 1000,
        max_video_duration: TIME_CAPSULE_MAX_VIDEO_SECONDS,
        allow_audio_recording: false,
        max_audios: 0,
        allow_image_attachment: false,
        allow_video_attachment: false,
        is_demo: false,
        type: TIME_CAPSULE_PLAN_ID,
        plan_id: TIME_CAPSULE_PLAN_ID,
        timezone: TIMEZONE,
        country_code: "ES",
        language: "es",
        limits_json: withTimeCapsuleSettings(limitsJson, { years, coupleNames: name }),
      };

      if (isEditing && eventId) {
        const { error } = await supabase.from("events").update(payload as never).eq("id", eventId);
        if (error) throw error;
        setSavedEventId(eventId);
        toast({ title: "Cápsula actualizada", description: "Los cambios se han guardado." });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: created, error } = await supabase
          .from("events")
          .insert({ ...payload, owner_id: user?.id || null } as never)
          .select()
          .single();
        if (error) throw error;
        setSavedEventId(created.id);
        toast({ title: "Cápsula creada", description: "Ya puedes descargar el QR." });
      }
    } catch (error) {
      console.error("Error saving time capsule:", error);
      toast({ title: "Error", description: "No se pudo guardar la cápsula.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-demo2-shell min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="admin-demo2-shell min-h-screen bg-background p-4 md:p-6" data-scroll-container>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => navigate(`${pathPrefix}/event-management`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2" data-scroll-anchor>
            <Heart className="w-5 h-5 text-[#f06a5f]" />
            {isEditing ? name || "Cápsula del tiempo" : "Nueva cápsula del tiempo"}
          </h1>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {planSelector}

            {!isEditing && onOwnerEmailChange && (
              <div className="space-y-2">
                <Label htmlFor="capsuleOwnerEmail">Email del propietario</Label>
                <Input
                  id="capsuleOwnerEmail"
                  type="email"
                  value={ownerEmail}
                  onChange={(inputEvent) => onOwnerEmailChange(inputEvent.target.value)}
                  placeholder="email@dominio.com"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="capsuleName">Nombre de los novios</Label>
              <Input
                id="capsuleName"
                value={name}
                onChange={(inputEvent) => setName(inputEvent.target.value)}
                placeholder="Ana & Marcos"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capsuleDescription">Texto para los invitados (opcional)</Label>
              <Textarea
                id="capsuleDescription"
                value={description}
                onChange={(inputEvent) => setDescription(inputEvent.target.value)}
                placeholder="Si lo dejas vacío se usará el texto romántico por defecto."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Foto de la cápsula</Label>
              <div className="flex items-center gap-3">
                {coverUrl ? (
                  <img src={coverUrl} alt="Portada" className="h-20 w-20 rounded-xl object-cover border border-border" />
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(inputEvent) => {
                    const file = inputEvent.target.files?.[0];
                    if (file) handleCoverUpload(file);
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                  {coverUrl ? "Cambiar foto" : "Subir foto"}
                </Button>
                {coverUrl && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setCoverUrl("")}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capsuleWeddingDate">Fecha de la boda</Label>
                <Input
                  id="capsuleWeddingDate"
                  type="date"
                  value={weddingDate}
                  onChange={(inputEvent) => setWeddingDate(inputEvent.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">El QR estará activo ese día (36 horas).</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capsuleYears">Se abrirá dentro de</Label>
                <select
                  id="capsuleYears"
                  value={years}
                  onChange={(selectEvent) => setYears(Number(selectEvent.target.value))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {TIME_CAPSULE_YEAR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} años
                    </option>
                  ))}
                </select>
                {openDate && (
                  <p className="text-xs text-muted-foreground">
                    Apertura: {format(openDate, "dd/MM/yyyy")}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capsulePassword">Contraseña de los novios</Label>
              <div className="flex gap-2">
                <Input
                  id="capsulePassword"
                  value={password}
                  onChange={(inputEvent) => setPassword(inputEvent.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(password)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Acceso de los novios: acceso.revelao.cam/events/{password}
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Guardar cambios" : "Crear cápsula del tiempo"}
            </Button>
          </form>
        </Card>

        {publicUrl && (
          <Card className="p-6 space-y-4 text-center">
            <h2 className="text-lg font-semibold">QR para los invitados</h2>
            <div className="flex justify-center bg-white p-4 rounded-xl w-fit mx-auto">
              <QRCodeSVG value={publicUrl} size={200} level="H" />
            </div>
            <p className="text-xs text-muted-foreground break-all">{publicUrl}</p>
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(publicUrl)}>
              <Copy className="w-4 h-4 mr-2" /> Copiar enlace
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TimeCapsuleAdminForm;
