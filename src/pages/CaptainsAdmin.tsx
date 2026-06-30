import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  Flag,
  Gamepad2,
  Mic,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Video,
  X,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  captainsQueryKeys,
  useCaptainsChallengeCatalog,
  useCaptainsEventDetail,
  useCaptainsEvents,
  useCaptainsRanking,
} from "@/hooks/useCaptains";
import {
  approveCaptainsEvidence,
  createCaptainsGame,
  deleteCaptainsEvidence,
  finishCaptainsEvent,
  getCaptainsEvidence,
  getCaptainsEvidenceSignedUrl,
  getCaptainsTableChallenges,
  rejectCaptainsEvidence,
  replaceCaptainsEventChallenges,
  updateCaptainsEvent,
  updateCaptainsTables,
} from "@/lib/captainsService";
import { getCaptainsQrValue, getCaptainsPublicUrl } from "@/lib/captainsUtils";
import type {
  CaptainsChallengeInput,
  CaptainsDifficulty,
  CaptainsEvent,
  CaptainsEventChallenge,
  CaptainsEvidence,
  CaptainsEvidenceType,
  CaptainsTable,
  CaptainsTableChallenge,
} from "@/lib/captainsTypes";

const DEFAULT_DESCRIPTION =
  "Bienvenidos a Capitanes by Revelao.\nCada mesa tendrá un capitán encargado de guiar a su equipo durante el juego.\nTendréis que completar retos, subir pruebas y competir contra el resto de mesas.\nPreparad la cámara, afinad la voz y jugad en equipo.\nQue empiece la misión.";
const DEFAULT_PRIMARY_COLOR = "#d8a35d";
const DEFAULT_SECONDARY_COLOR = "#f3dfc1";
const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

const EMPTY_CHALLENGE: CaptainsChallengeInput = {
  title: "",
  description: "",
  evidence_type: "photo",
  points: 10,
  category: "",
  difficulty: "easy",
  has_time_limit: false,
  time_limit_seconds: null,
};

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programado",
  active: "Activo",
  finished: "Finalizado",
  archived: "Archivado",
  pending: "Pendiente",
  ready: "Listo",
  in_progress: "En curso",
  submitted: "Enviado",
  completed: "Completado",
  failed: "Fallido",
  time_expired: "Tiempo agotado",
  pending_review: "Pendiente revisión",
  rejected: "Rechazado",
  deleted: "Eliminado",
  uploaded: "Subido",
  approved: "Aprobado",
};

const evidenceLabels: Record<CaptainsEvidenceType, string> = {
  photo: "Foto",
  video: "Vídeo",
  audio: "Audio",
};

const difficultyLabels: Record<CaptainsDifficulty, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
  special: "Especial",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const timeInputToIso = (value: string) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
};

const useRequireAdmin = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/admin-login");
    });
  }, [navigate]);
};

const AdminFrame = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => {
  const navigate = useNavigate();

  return (
    <div className="admin-demo2-shell min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              </div>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate("/event-management")}>
                Eventos Revelao
              </Button>
              <Button variant="outline" onClick={() => navigate("/admin/capitanes")}>
                Capitanes
              </Button>
            </div>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <Card className="p-10 text-center">
    <Gamepad2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </Card>
);

export const CaptainsAdminList = () => {
  useRequireAdmin();
  const navigate = useNavigate();
  const { data: events = [], isLoading, isError } = useCaptainsEvents();

  return (
    <AdminFrame title="Capitanes by Revelao" subtitle="Gestiona juegos de retos por mesas.">
      <div className="flex items-center justify-between gap-3">
        <div />
        <Button className="gap-2" onClick={() => navigate("/admin/capitanes/new")}>
          <Plus className="h-4 w-4" />
          Nuevo Capitán
        </Button>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Cargando juegos...</p>
        ) : isError ? (
          <p className="p-8 text-center text-sm text-destructive">No hemos podido cargar la información. Inténtalo de nuevo.</p>
        ) : events.length === 0 ? (
          <EmptyState text="Todavía no has creado ningún juego de Capitanes." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Evento</th>
                  <th className="py-3 pr-4 font-medium">Estado</th>
                  <th className="py-3 pr-4 font-medium">Creación</th>
                  <th className="py-3 pr-4 font-medium">Mesas</th>
                  <th className="py-3 pr-4 font-medium">Retos</th>
                  <th className="py-3 pr-4 font-medium">Puntuación</th>
                  <th className="py-3 pr-4 font-medium">Inicio</th>
                  <th className="py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-medium">{event.name}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={event.status === "active" ? "default" : "outline"}>{statusLabels[event.status]}</Badge>
                    </td>
                    <td className="py-3 pr-4">{formatDateTime(event.created_at)}</td>
                    <td className="py-3 pr-4">{event.table_count}</td>
                    <td className="py-3 pr-4">{event.challenge_count}</td>
                    <td className="py-3 pr-4">{event.scoring_mode === "automatic" ? "Automática" : "Manual"}</td>
                    <td className="py-3 pr-4">{formatDateTime(event.start_time)}</td>
                    <td className="py-3">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/admin/capitanes/${event.id}`)}>
                        <Eye className="h-4 w-4" />
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminFrame>
  );
};

const ChallengeEditor = ({
  challenge,
  index,
  onChange,
  onDelete,
}: {
  challenge: CaptainsChallengeInput;
  index: number;
  onChange: (challenge: CaptainsChallengeInput) => void;
  onDelete: () => void;
}) => (
  <Card className="p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-sm font-semibold">Reto {index + 1}</p>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Eliminar reto">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Título</span>
        <Input value={challenge.title} onChange={(event) => onChange({ ...challenge, title: event.target.value })} />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Categoría</span>
        <Input value={challenge.category} onChange={(event) => onChange({ ...challenge, category: event.target.value })} />
      </label>
      <label className="space-y-1 md:col-span-2">
        <span className="text-xs font-medium text-muted-foreground">Descripción</span>
        <Textarea
          value={challenge.description}
          onChange={(event) => onChange({ ...challenge, description: event.target.value })}
          rows={2}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Evidencia</span>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={challenge.evidence_type}
          onChange={(event) => onChange({ ...challenge, evidence_type: event.target.value as CaptainsEvidenceType })}
        >
          <option value="photo">Foto</option>
          <option value="video">Vídeo</option>
          <option value="audio">Audio</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Dificultad</span>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={challenge.difficulty}
          onChange={(event) => onChange({ ...challenge, difficulty: event.target.value as CaptainsDifficulty })}
        >
          <option value="easy">Fácil</option>
          <option value="medium">Media</option>
          <option value="hard">Difícil</option>
          <option value="special">Especial</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">Puntos máximos</span>
        <Input
          type="number"
          min={1}
          value={challenge.points}
          onChange={(event) => onChange({ ...challenge, points: Number(event.target.value) })}
        />
      </label>
      <div className="grid grid-cols-[auto_1fr] items-end gap-3">
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={challenge.has_time_limit}
            onChange={(event) =>
              onChange({
                ...challenge,
                has_time_limit: event.target.checked,
                time_limit_seconds: event.target.checked ? challenge.time_limit_seconds || 60 : null,
              })
            }
          />
          Tiene tiempo límite
        </label>
        <Input
          type="number"
          min={1}
          disabled={!challenge.has_time_limit}
          value={challenge.time_limit_seconds ?? ""}
          placeholder="Segundos"
          onChange={(event) => onChange({ ...challenge, time_limit_seconds: Number(event.target.value) })}
        />
      </div>
    </div>
  </Card>
);

export const CaptainsAdminForm = ({ edit = false }: { edit?: boolean }) => {
  useRequireAdmin();
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { toast } = useToast();
  const { data: detail, isLoading } = useCaptainsEventDetail(edit ? eventId : null);
  const { data: catalog = [] } = useCaptainsChallengeCatalog();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [tableCount, setTableCount] = useState(0);
  const [captains, setCaptains] = useState<Array<{ id?: string; table_number: number; table_name: string; captain_name: string }>>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [scoringMode, setScoringMode] = useState<"automatic" | "manual">("automatic");
  const [showLiveGalleryAfterCompletion, setShowLiveGalleryAfterCompletion] = useState(true);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [selectedChallenges, setSelectedChallenges] = useState<CaptainsChallengeInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!edit || !detail) return;
    setName(detail.event.name);
    setDescription(detail.event.description || DEFAULT_DESCRIPTION);
    setTableCount(detail.tables.length);
    setCaptains(
      detail.tables.map((table) => ({
        id: table.id,
        table_number: table.table_number,
        table_name: table.table_name,
        captain_name: table.captain_name || "",
      })),
    );
    setStartTime(toTimeInput(detail.event.start_time));
    setEndTime(toTimeInput(detail.event.end_time));
    setScoringMode(detail.event.scoring_mode);
    setShowLiveGalleryAfterCompletion(detail.event.show_live_gallery_after_completion ?? true);
    setPrimaryColor(detail.event.primary_color || DEFAULT_PRIMARY_COLOR);
    setSecondaryColor(detail.event.secondary_color || DEFAULT_SECONDARY_COLOR);
    setBackgroundImageUrl(detail.event.background_image_url || "");
    setSelectedChallenges(
      detail.challenges.map((challenge) => ({
        id: challenge.id,
        catalog_challenge_id: challenge.catalog_challenge_id,
        title: challenge.title,
        description: challenge.description,
        evidence_type: challenge.evidence_type,
        points: challenge.points,
        category: challenge.category,
        difficulty: challenge.difficulty,
        has_time_limit: challenge.has_time_limit,
        time_limit_seconds: challenge.time_limit_seconds,
        order_index: challenge.order_index,
        is_required: challenge.is_required,
      })),
    );
  }, [detail, edit]);

  const syncTableCount = (count: number) => {
    const cleanCount = Math.max(0, Math.floor(count));
    setTableCount(cleanCount);
    setCaptains((prev) =>
      Array.from({ length: cleanCount }, (_, index) => {
        const existing = prev[index];
        return (
          existing || {
            table_number: index + 1,
            table_name: `Mesa ${index + 1}`,
            captain_name: "",
          }
        );
      }).map((table, index) => ({ ...table, table_number: index + 1, table_name: table.table_name || `Mesa ${index + 1}` })),
    );
  };

  const validateStepOne = () => {
    if (!name.trim()) return "El nombre del evento es obligatorio.";
    if (tableCount <= 0 || captains.length === 0) return "Añade al menos una mesa para crear el juego.";
    return null;
  };

  const validateChallenges = () => {
    if (selectedChallenges.length === 0) return "No se puede crear evento sin retos.";
    for (const challenge of selectedChallenges) {
      if (!challenge.title.trim() || !challenge.description.trim()) return "Cada reto debe tener título y descripción.";
      if (!challenge.evidence_type) return "Cada reto debe tener evidencia.";
      if (!challenge.points || challenge.points <= 0) return "Cada reto debe tener puntos.";
      if (challenge.has_time_limit && (!challenge.time_limit_seconds || challenge.time_limit_seconds <= 0)) {
        return "Si tiene tiempo, debe tener segundos.";
      }
    }
    return null;
  };

  const handleContinue = () => {
    const error = validateStepOne();
    if (error) {
      toast({ title: "Revisa los datos", description: error, variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const addCatalogChallenge = (catalogId: string) => {
    const item = catalog.find((challenge) => challenge.id === catalogId);
    if (!item) return;
    setSelectedChallenges((prev) => [
      ...prev,
      {
        catalog_challenge_id: item.id,
        title: item.title,
        description: item.description,
        evidence_type: item.evidence_type,
        points: item.default_points,
        category: item.category,
        difficulty: item.difficulty,
        has_time_limit: item.has_time_limit,
        time_limit_seconds: item.time_limit_seconds,
        order_index: prev.length + 1,
        is_required: false,
      },
    ]);
  };

  const handleSave = async () => {
    const stepOneError = validateStepOne();
    const challengeError = validateChallenges();
    if (stepOneError || challengeError) {
      toast({ title: "Revisa el juego", description: stepOneError || challengeError || "", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      const eventPayload = {
        name: name.trim(),
        description: description.trim(),
        start_time: timeInputToIso(startTime),
        end_time: timeInputToIso(endTime),
        scoring_mode: scoringMode,
        show_live_gallery_after_completion: showLiveGalleryAfterCompletion,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_image_url: backgroundImageUrl.trim() || null,
        status: startTime ? "scheduled" as const : "active" as const,
      };

      if (edit && eventId) {
        await updateCaptainsEvent(eventId, eventPayload);
        await updateCaptainsTables(eventId, captains);
        await replaceCaptainsEventChallenges(eventId, selectedChallenges);
        toast({ title: "Juego actualizado", description: "Los cambios se han guardado correctamente." });
        navigate(`/admin/capitanes/${eventId}`);
      } else {
        const created = await createCaptainsGame({
          event: eventPayload,
          tables: captains,
          challenges: selectedChallenges,
        });
        toast({ title: "Juego creado", description: "Capitanes ya está listo para usar." });
        navigate(`/admin/capitanes/${created?.event.id}`);
      }
    } catch (error) {
      console.error("Error saving captains game:", error);
      toast({
        title: "Error",
        description: "No hemos podido cargar la información. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (edit && isLoading) {
    return (
      <AdminFrame title="Editar Capitanes">
        <Card className="p-8 text-center text-sm text-muted-foreground">Cargando juego...</Card>
      </AdminFrame>
    );
  }

  return (
    <AdminFrame title={edit ? "Editar juego de Capitanes" : "Nuevo juego de Capitanes"} subtitle={`Paso ${step} de 2`}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="gap-2" onClick={() => navigate(edit && eventId ? `/admin/capitanes/${eventId}` : "/admin/capitanes")}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
      </div>

      {step === 1 ? (
        <Card className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Nombre del evento</span>
              <Input value={name} placeholder="Boda de Ana & Marcos" onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Descripción inicial</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} />
            </label>
            <div className="grid gap-4 rounded-md border border-border p-4 md:col-span-2 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Estilo visual de la experiencia pública</span>
                <p className="text-xs text-muted-foreground">Estos colores se aplican a botones, acentos y al ambiente visual de Capitanes.</p>
              </div>
              <label className="space-y-1">
                <span className="text-sm font-medium">Color principal</span>
                <div className="flex gap-2">
                  <Input type="color" value={isHexColor(primaryColor) ? primaryColor : DEFAULT_PRIMARY_COLOR} onChange={(event) => setPrimaryColor(event.target.value)} className="h-10 w-14 p-1" />
                  <Input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} placeholder="#d8a35d" />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Color secundario</span>
                <div className="flex gap-2">
                  <Input type="color" value={isHexColor(secondaryColor) ? secondaryColor : DEFAULT_SECONDARY_COLOR} onChange={(event) => setSecondaryColor(event.target.value)} className="h-10 w-14 p-1" />
                  <Input value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} placeholder="#f3dfc1" />
                </div>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Foto de fondo pública</span>
                <Input value={backgroundImageUrl} onChange={(event) => setBackgroundImageUrl(event.target.value)} placeholder="https://..." />
                <p className="text-xs text-muted-foreground">URL de la imagen que se verá detrás de la experiencia móvil de los invitados.</p>
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-sm font-medium">Número de mesas</span>
              <Input type="number" min={1} value={tableCount || ""} onChange={(event) => syncTableCount(Number(event.target.value))} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Hora de inicio</span>
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Hora de fin</span>
              <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              <p className="text-xs text-muted-foreground">Al llegar esta hora, se podrá ver el resumen con los equipos que hayan participado.</p>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Modo de puntuación</span>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={scoringMode}
                onChange={(event) => setScoringMode(event.target.value as "automatic" | "manual")}
              >
                <option value="automatic">Puntuación automática</option>
                <option value="manual">Revisión manual</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Visibilidad del contenido entre mesas</span>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={showLiveGalleryAfterCompletion ? "yes" : "no"}
                onChange={(event) => setShowLiveGalleryAfterCompletion(event.target.value === "yes")}
              >
                <option value="yes">Mostrar contenido del resto de mesas al finalizar todos los retos</option>
                <option value="no">No mostrar contenido del resto de mesas</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Cuando una mesa complete todos sus retos, podrá ver en tiempo real las evidencias subidas por el resto de mesas.
              </p>
            </label>
          </div>

          {captains.length === 0 ? (
            <EmptyState text="Añade al menos una mesa para crear el juego." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {captains.map((table, index) => (
                <label key={index} className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Mesa {index + 1} - Capitán/a</span>
                  <Input
                    value={table.captain_name}
                    onChange={(event) =>
                      setCaptains((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, captain_name: event.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Opcional"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleContinue}>Continuar</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit space-y-4 p-4">
            <div>
              <h2 className="font-semibold">Catálogo de retos</h2>
              <p className="text-sm text-muted-foreground">Selecciona retos guardados o crea uno nuevo.</p>
            </div>
            <div className="space-y-2">
              {catalog.map((challenge) => (
                <button
                  key={challenge.id}
                  type="button"
                  className="w-full rounded-md border border-border p-3 text-left transition-colors hover:bg-muted"
                  onClick={() => addCatalogChallenge(challenge.id)}
                >
                  <p className="text-sm font-medium">{challenge.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evidenceLabels[challenge.evidence_type]} · {challenge.default_points} pts · {difficultyLabels[challenge.difficulty]}
                  </p>
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => setSelectedChallenges((prev) => [...prev, { ...EMPTY_CHALLENGE }])}>
              <Plus className="h-4 w-4" />
              Crear reto nuevo
            </Button>
          </Card>

          <div className="space-y-4">
            {selectedChallenges.length === 0 ? (
              <EmptyState text="Todavía no hay retos seleccionados para este juego." />
            ) : (
              selectedChallenges.map((challenge, index) => (
                <ChallengeEditor
                  key={`${challenge.catalog_challenge_id || "custom"}-${index}`}
                  challenge={challenge}
                  index={index}
                  onChange={(next) => setSelectedChallenges((prev) => prev.map((item, itemIndex) => (itemIndex === index ? next : item)))}
                  onDelete={() => setSelectedChallenges((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                />
              ))
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Guardando..." : edit ? "Guardar cambios" : "Crear juego de Capitanes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminFrame>
  );
};

const EvidencePreview = ({ evidence }: { evidence: CaptainsEvidence }) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    getCaptainsEvidenceSignedUrl(evidence.file_url)
      .then((signedUrl) => {
        if (active) setUrl(signedUrl);
      })
      .catch(() => setUrl(""));
    return () => {
      active = false;
    };
  }, [evidence.file_url]);

  if (!url) {
    return <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">Preview</div>;
  }

  if (evidence.evidence_type === "photo") {
    return <img src={url} alt="" className="aspect-video w-full rounded-md object-cover" />;
  }
  if (evidence.evidence_type === "video") {
    return <video src={url} controls className="aspect-video w-full rounded-md bg-black object-contain" />;
  }
  return <audio src={url} controls className="w-full" />;
};

const EvidenceActions = ({
  evidence,
  event,
  maxPoints,
  onDone,
}: {
  evidence: CaptainsEvidence;
  event: CaptainsEvent;
  maxPoints?: number;
  onDone: () => void;
}) => {
  const { toast } = useToast();
  const [points, setPoints] = useState(evidence.points_awarded || maxPoints || 0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: "approve" | "reject" | "delete") => {
    if (action === "delete") {
      const confirmed = window.confirm(
        "¿Seguro que quieres eliminar esta evidencia?\nSe restarán los puntos asociados y se actualizará el ranking.",
      );
      if (!confirmed) return;
    }
    try {
      setBusy(true);
      if (action === "approve") await approveCaptainsEvidence(evidence.id, { pointsAwarded: points, adminComment: comment || null });
      if (action === "reject") await rejectCaptainsEvidence(evidence.id, comment || null);
      if (action === "delete") await deleteCaptainsEvidence(evidence.id);
      toast({ title: "Ranking actualizado", description: "La acción se ha aplicado correctamente." });
      onDone();
    } catch (error) {
      console.error("Evidence action error:", error);
      toast({ title: "Error", description: "No hemos podido cargar la información. Inténtalo de nuevo.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {event.scoring_mode === "manual" ? (
        <>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <Input type="number" min={0} value={points} onChange={(ev) => setPoints(Number(ev.target.value))} />
            <Input value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="Comentario interno" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" className="gap-1" disabled={busy} onClick={() => run("approve")}>
              <Check className="h-4 w-4" />
              Aprobar
            </Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => run("reject")}>
              <X className="h-4 w-4" />
              Rechazar
            </Button>
            <Button size="sm" variant="destructive" className="gap-1" disabled={busy} onClick={() => run("delete")}>
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" variant="destructive" className="w-full gap-1" disabled={busy} onClick={() => run("delete")}>
          <Trash2 className="h-4 w-4" />
          Eliminar evidencia
        </Button>
      )}
    </div>
  );
};

export const CaptainsAdminDetail = ({ view = "detail" }: { view?: "detail" | "review" | "ranking" }) => {
  useRequireAdmin();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: detail, isLoading, isError, refetch } = useCaptainsEventDetail(eventId);
  const { data: ranking = [] } = useCaptainsRanking(eventId);
  const { data: tableChallenges = [] } = useQuery({
    queryKey: ["captains", "table-challenges", eventId],
    queryFn: () => getCaptainsTableChallenges(eventId || ""),
    enabled: Boolean(eventId),
    refetchInterval: 5000,
  });
  const { data: evidence = [] } = useQuery({
    queryKey: captainsQueryKeys.evidence(eventId),
    queryFn: () => getCaptainsEvidence(eventId || ""),
    enabled: Boolean(eventId),
    refetchInterval: 5000,
  });
  const [selectedEvidence, setSelectedEvidence] = useState<CaptainsEvidence | null>(null);

  const challengesById = useMemo(() => {
    const map = new Map<string, CaptainsEventChallenge>();
    detail?.challenges.forEach((challenge) => map.set(challenge.id, challenge));
    return map;
  }, [detail?.challenges]);

  const tableChallengesByTable = useMemo(() => {
    const map = new Map<string, CaptainsTableChallenge[]>();
    tableChallenges.forEach((challenge) => {
      map.set(challenge.table_id, [...(map.get(challenge.table_id) || []), challenge]);
    });
    return map;
  }, [tableChallenges]);

  const evidenceByTableChallenge = useMemo(() => {
    const map = new Map<string, CaptainsEvidence>();
    evidence.forEach((item) => {
      if (!map.has(item.table_challenge_id)) map.set(item.table_challenge_id, item);
    });
    return map;
  }, [evidence]);

  const reviewEvidence = evidence.filter((item) => ["uploaded", "pending_review"].includes(item.status));

  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: captainsQueryKeys.ranking(eventId) });
    queryClient.invalidateQueries({ queryKey: captainsQueryKeys.evidence(eventId) });
    queryClient.invalidateQueries({ queryKey: ["captains", "table-challenges", eventId] });
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Enlace copiado", description: "La URL pública está en el portapapeles." });
  };

  const handleDownloadQr = () => {
    const svg = document.getElementById("captains-admin-qr");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${detail?.event.slug || "capitanes"}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleFinish = async () => {
    if (!eventId) return;
    const confirmed = window.confirm("¿Seguro que quieres finalizar este juego de Capitanes?");
    if (!confirmed) return;
    await finishCaptainsEvent(eventId);
    toast({ title: "Juego finalizado", description: "El evento ha pasado a estado finalizado." });
    refreshAll();
  };

  const handleToggleLiveGallery = async () => {
    if (!detail?.event.id) return;
    const nextValue = !(detail.event.show_live_gallery_after_completion ?? true);
    await updateCaptainsEvent(detail.event.id, { show_live_gallery_after_completion: nextValue });
    toast({
      title: nextValue ? "Galería live activada" : "Galería live desactivada",
      description: nextValue
        ? "Las mesas podrán ver recuerdos al completar todos los retos."
        : "La ruta pública live mostrará que la galería no está disponible.",
    });
    refreshAll();
  };

  if (isLoading) {
    return (
      <AdminFrame title="Capitanes">
        <Card className="p-8 text-center text-sm text-muted-foreground">Cargando juego...</Card>
      </AdminFrame>
    );
  }

  if (isError || !detail) {
    return (
      <AdminFrame title="Capitanes">
        <EmptyState text="No hemos podido cargar la información. Inténtalo de nuevo." />
      </AdminFrame>
    );
  }

  const { event, tables, challenges } = detail;
  const publicUrl = event.public_url || getCaptainsPublicUrl(event.slug);
  const qrValue = event.qr_url || getCaptainsQrValue(event.slug);
  const visibleEvidence = view === "review" ? reviewEvidence : evidence;
  const liveVisibleEvidence = evidence.filter((item) => item.file_url && !["deleted", "rejected"].includes(item.status));
  const photoCount = liveVisibleEvidence.filter((item) => item.evidence_type === "photo").length;
  const videoCount = liveVisibleEvidence.filter((item) => item.evidence_type === "video").length;
  const audioCount = liveVisibleEvidence.filter((item) => item.evidence_type === "audio").length;
  const lastLiveEvidence = liveVisibleEvidence[0];

  return (
    <AdminFrame title={view === "review" ? "Revisión manual" : view === "ranking" ? "Ranking de Capitanes" : event.name}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="gap-2" onClick={() => navigate("/admin/capitanes")}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/admin/capitanes/${event.id}/ranking`)}>
            <Trophy className="h-4 w-4" />
            Ranking
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/admin/capitanes/${event.id}/review`)}>
            <Flag className="h-4 w-4" />
            Revisión
          </Button>
        </div>
      </div>

      {view !== "ranking" ? (
        <Card className="p-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold">{event.name}</h2>
                <Badge variant={event.status === "active" ? "default" : "outline"}>{statusLabels[event.status]}</Badge>
              </div>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{event.description}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Inicio" value={formatDateTime(event.start_time)} />
                <Info label="Fin" value={formatDateTime(event.end_time)} />
                <Info label="Puntuación" value={event.scoring_mode === "automatic" ? "Automática" : "Manual"} />
                <Info label="Mesas" value={String(tables.length)} />
                <Info label="Retos" value={String(challenges.length)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={() => handleCopy(publicUrl)}>
                  <Copy className="h-4 w-4" />
                  Copiar enlace
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleDownloadQr}>
                  <Download className="h-4 w-4" />
                  Descargar QR
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => navigate(`/admin/capitanes/${event.id}/edit`)}>
                  <Pencil className="h-4 w-4" />
                  Editar evento
                </Button>
                <Button variant="destructive" className="gap-2" onClick={handleFinish} disabled={event.status === "finished"}>
                  <Flag className="h-4 w-4" />
                  Finalizar evento
                </Button>
              </div>
              <p className="break-all rounded-md bg-muted p-3 text-xs text-muted-foreground">{publicUrl}</p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-md border border-border p-4">
              <QRCodeSVG id="captains-admin-qr" value={qrValue} size={160} includeMargin />
              <p className="mt-2 text-center text-xs text-muted-foreground">QR del evento</p>
            </div>
          </div>
        </Card>
      ) : null}

      {view === "detail" ? (
        <Card className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Galería live</h2>
                <Badge variant={(event.show_live_gallery_after_completion ?? true) ? "default" : "outline"}>
                  {(event.show_live_gallery_after_completion ?? true) ? "Activa" : "Desactivada"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Las mesas podrán ver el contenido del resto de equipos cuando terminen todos los retos.
              </p>
            </div>
            <Button variant={(event.show_live_gallery_after_completion ?? true) ? "outline" : "default"} onClick={handleToggleLiveGallery}>
              {(event.show_live_gallery_after_completion ?? true) ? "Desactivar visibilidad" : "Activar visibilidad"}
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Info label="Visibles" value={String(liveVisibleEvidence.length)} />
            <Info label="Fotos" value={String(photoCount)} />
            <Info label="Vídeos" value={String(videoCount)} />
            <Info label="Audios" value={String(audioCount)} />
            <Info label="Última subida" value={lastLiveEvidence ? formatDateTime(lastLiveEvidence.created_at) : "-"} />
          </div>
        </Card>
      ) : null}

      {view !== "review" ? (
        <RankingCard ranking={ranking} tableChallengesByTable={tableChallengesByTable} totalChallenges={challenges.length} />
      ) : null}

      {view === "detail" ? (
        <ProgressCard
          tables={tables}
          challengesById={challengesById}
          tableChallengesByTable={tableChallengesByTable}
          evidenceByTableChallenge={evidenceByTableChallenge}
          totalChallenges={challenges.length}
        />
      ) : null}

      {view !== "ranking" ? (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{view === "review" ? "Evidencias pendientes" : "Feed de evidencias"}</h2>
              <p className="text-sm text-muted-foreground">
                {view === "review" ? "Solo evidencias pendientes o revisables." : "Todas las evidencias subidas por las mesas."}
              </p>
            </div>
          </div>
          {visibleEvidence.length === 0 ? (
            <EmptyState text="Todavía no se ha subido ninguna evidencia." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleEvidence.map((item) => {
                const table = tables.find((candidate) => candidate.id === item.table_id);
                const tableChallenge = tableChallenges.find((candidate) => candidate.id === item.table_challenge_id);
                const challenge = tableChallenge ? challengesById.get(tableChallenge.challenge_id) : undefined;
                return (
                  <Card key={item.id} className="space-y-3 p-3">
                    <button type="button" className="block w-full text-left" onClick={() => setSelectedEvidence(item)}>
                      <EvidencePreview evidence={item} />
                    </button>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{table?.table_name || "Mesa"}</p>
                        <Badge variant={item.status === "approved" ? "default" : "outline"}>{statusLabels[item.status]}</Badge>
                      </div>
                      <p className="text-muted-foreground">{item.captain_name || table?.captain_name || "Sin capitán"}</p>
                      <p>{challenge?.title || "Reto"}</p>
                      <p className="text-xs text-muted-foreground">
                        {evidenceLabels[item.evidence_type]} · {formatDateTime(item.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Tiempo: {item.elapsed_seconds ?? "-"}s · Puntos: {item.points_awarded}
                      </p>
                      {challenge ? (
                        <p className="text-xs text-muted-foreground">
                          Límite: {challenge.has_time_limit ? `${challenge.time_limit_seconds}s` : "sin tiempo"} · Máx: {challenge.points} pts
                        </p>
                      ) : null}
                    </div>
                    <EvidenceActions evidence={item} event={event} maxPoints={challenge?.points} onDone={refreshAll} />
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      <Dialog open={!!selectedEvidence} onOpenChange={(open) => !open && setSelectedEvidence(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Evidencia</DialogTitle>
            <DialogDescription>Vista previa de la evidencia subida por la mesa.</DialogDescription>
          </DialogHeader>
          {selectedEvidence ? <EvidencePreview evidence={selectedEvidence} /> : null}
        </DialogContent>
      </Dialog>
    </AdminFrame>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-border p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold">{value}</p>
  </div>
);

const RankingCard = ({
  ranking,
  tableChallengesByTable,
  totalChallenges,
}: {
  ranking: CaptainsTable[];
  tableChallengesByTable: Map<string, CaptainsTableChallenge[]>;
  totalChallenges: number;
}) => (
  <Card className="p-5">
    <h2 className="mb-4 font-semibold">Ranking en tiempo real</h2>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-3 pr-4 font-medium">Posición</th>
            <th className="py-3 pr-4 font-medium">Mesa</th>
            <th className="py-3 pr-4 font-medium">Capitán</th>
            <th className="py-3 pr-4 font-medium">Puntos</th>
            <th className="py-3 pr-4 font-medium">Completados</th>
            <th className="py-3 pr-4 font-medium">Fallidos</th>
            <th className="py-3 pr-4 font-medium">Pendientes</th>
            <th className="py-3 font-medium">Última actividad</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((table: any, index) => {
            const rows = tableChallengesByTable.get(table.id) || [];
            const pending = Math.max(0, totalChallenges - rows.filter((row) => row.status !== "pending").length);
            return (
              <tr key={table.id} className="border-b last:border-b-0">
                <td className="py-3 pr-4 font-semibold">#{table.rank || index + 1}</td>
                <td className="py-3 pr-4">{table.table_name}</td>
                <td className="py-3 pr-4">{table.active_captain_name || table.captain_name || "-"}</td>
                <td className="py-3 pr-4">{table.total_points}</td>
                <td className="py-3 pr-4">{table.completed_challenges}</td>
                <td className="py-3 pr-4">{table.failed_challenges}</td>
                <td className="py-3 pr-4">{pending}</td>
                <td className="py-3">{formatDateTime(table.last_activity_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </Card>
);

const ProgressCard = ({
  tables,
  challengesById,
  tableChallengesByTable,
  evidenceByTableChallenge,
  totalChallenges,
}: {
  tables: CaptainsTable[];
  challengesById: Map<string, CaptainsEventChallenge>;
  tableChallengesByTable: Map<string, CaptainsTableChallenge[]>;
  evidenceByTableChallenge: Map<string, CaptainsEvidence>;
  totalChallenges: number;
}) => (
  <Card className="p-5">
    <h2 className="mb-4 font-semibold">Progreso por mesa</h2>
    {tables.length === 0 ? (
      <EmptyState text="Añade al menos una mesa para crear el juego." />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-3 pr-4 font-medium">Mesa</th>
              <th className="py-3 pr-4 font-medium">Capitán</th>
              <th className="py-3 pr-4 font-medium">Reto actual</th>
              <th className="py-3 pr-4 font-medium">Estado</th>
              <th className="py-3 pr-4 font-medium">Tiempo restante</th>
              <th className="py-3 pr-4 font-medium">Puntos</th>
              <th className="py-3 pr-4 font-medium">Progreso</th>
              <th className="py-3 font-medium">Última evidencia</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const rows = tableChallengesByTable.get(table.id) || [];
              const current =
                rows.find((row) => ["ready", "in_progress", "submitted", "pending_review"].includes(row.status)) ||
                rows.find((row) => row.status === "pending") ||
                rows[rows.length - 1];
              const challenge = current ? challengesById.get(current.challenge_id) : undefined;
              const evidence = current ? evidenceByTableChallenge.get(current.id) : undefined;
              const currentIndex = current ? rows.findIndex((row) => row.id === current.id) + 1 : 0;
              return (
                <tr key={table.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-4">{table.table_name}</td>
                  <td className="py-3 pr-4">{table.active_captain_name || table.captain_name || "-"}</td>
                  <td className="py-3 pr-4">{challenge ? `${currentIndex}/${totalChallenges} · ${challenge.title}` : "-"}</td>
                  <td className="py-3 pr-4">{current ? statusLabels[current.status] : "-"}</td>
                  <td className="py-3 pr-4">{current?.remaining_seconds != null ? `${current.remaining_seconds}s` : "-"}</td>
                  <td className="py-3 pr-4">{table.total_points}</td>
                  <td className="py-3 pr-4">
                    {table.completed_challenges}/{totalChallenges}
                  </td>
                  <td className="py-3">{evidence ? formatDateTime(evidence.created_at) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

export default CaptainsAdminList;
