import { useEffect, useMemo, useRef, useState } from "react";
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
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Video,
  X,
  Camera,
  Upload,
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
import { getCaptainsQrValue, normalizeCaptainsPublicUrl } from "@/lib/captainsUtils";
import type {
  CaptainsChallengeInput,
  CaptainsChallengeCatalogItem,
  CaptainsDifficulty,
  CaptainsEvent,
  CaptainsEventChallenge,
  CaptainsEvidence,
  CaptainsEvidenceType,
  CaptainsSpriteConfig,
  CaptainsSpriteStyle,
  CaptainsTable,
  CaptainsTableChallenge,
} from "@/lib/captainsTypes";

const DEFAULT_DESCRIPTION =
  "Bienvenidos a Capitanes by Revelao.\nCada mesa tendrá un capitán encargado de guiar a su equipo durante el juego.\nTendréis que completar retos, subir pruebas y competir contra el resto de mesas.\nPreparad la cámara, afinad la voz y jugad en equipo.\nQue empiece la misión.";
const DEFAULT_PRIMARY_COLOR = "#f06a5f";
const DEFAULT_SECONDARY_COLOR = "#2f292d";
const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
const colorValue = (value: string, fallback: string) => (isHexColor(value) ? value : fallback);
const sanitizeCaptainPhotoName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "captain-photo";

const hairColorOptions = [
  { value: "blonde", label: "Rubio", color: "#e8c85b" },
  { value: "dark", label: "Moreno", color: "#151515" },
  { value: "brown", label: "Castaño", color: "#6b4328" },
] as const;

const skinColorOptions = [
  { value: "very_fair", label: "Muy blanca", color: "#f4d6c6" },
  { value: "fair", label: "Blanca", color: "#e9b98f" },
  { value: "tan", label: "Morena", color: "#a66b45" },
  { value: "dark", label: "Negra", color: "#5d3828" },
] as const;

const defaultCaptainSpriteConfig = (index = 0): CaptainsSpriteConfig => ({
  sex: index % 2 === 0 ? "male" : "female",
  hair_length: index % 2 === 0 ? "short" : "long",
  hair_color: hairColorOptions[index % hairColorOptions.length].value,
  skin_color: skinColorOptions[index % skinColorOptions.length].value,
  outfit_type: index % 2 === 0 ? "suit" : "dress",
  dress_color: ["#202235", "#6fa341", "#d32027"][index % 3],
  suit_color: ["#1f2937", "#202235", "#2f292d"][index % 3],
  tie_color: ["#f06a5f", "#f8d24a", "#ffffff"][index % 3],
});

const normalizeCaptainSpriteConfig = (config?: Partial<CaptainsSpriteConfig> | null, index = 0): CaptainsSpriteConfig => ({
  ...defaultCaptainSpriteConfig(index),
  ...(config || {}),
});

const captainSpriteOptions: Array<{
  value: CaptainsSpriteStyle;
  label: string;
  hair: string;
  skin: string;
  outfit: string;
  accent: string;
  legs: string;
}> = [
  { value: "suit", label: "Traje", hair: "#3f2d23", skin: "#f0bd91", outfit: "#1f2937", accent: "#ffffff", legs: "#111827" },
  { value: "dress", label: "Vestido", hair: "#5a3828", skin: "#f1c09a", outfit: "#202235", accent: "#ffffff", legs: "#202235" },
  { value: "jacket", label: "Chaqueta verde", hair: "#111111", skin: "#8f5f3d", outfit: "#4f7f3a", accent: "#ffffff", legs: "#3b2f24" },
  { value: "skirt", label: "Falda verde", hair: "#1f1712", skin: "#9b6747", outfit: "#4c7d3f", accent: "#ffffff", legs: "#3b2f24" },
  { value: "festival", label: "Fiesta", hair: "#2b1b12", skin: "#efb68c", outfit: "#8a4f22", accent: "#f06a5f", legs: "#654321" },
  { value: "tunic", label: "Túnica", hair: "#c9c9c9", skin: "#a87450", outfit: "#d5d5d5", accent: "#ffffff", legs: "#1f2937" },
  { value: "uniform", label: "Uniforme rojo", hair: "#141414", skin: "#edb28f", outfit: "#d32027", accent: "#f8d24a", legs: "#d32027" },
  { value: "kimono", label: "Kimono", hair: "#1c1c1c", skin: "#f2bd93", outfit: "#6fa341", accent: "#111111", legs: "#202235" },
];

const getDefaultCaptainSprite = (index: number) => captainSpriteOptions[index % captainSpriteOptions.length].value;
const getCaptainSpriteOption = (value?: CaptainsSpriteStyle | null) =>
  captainSpriteOptions.find((option) => option.value === value) || captainSpriteOptions[0];

const getSpriteColors = (value?: CaptainsSpriteStyle | null, config?: CaptainsSpriteConfig | null) => {
  if (config) {
    const hair = hairColorOptions.find((option) => option.value === config.hair_color)?.color || "#151515";
    const skin = skinColorOptions.find((option) => option.value === config.skin_color)?.color || "#e9b98f";
    const outfit = config.outfit_type === "dress" ? colorValue(config.dress_color, "#202235") : colorValue(config.suit_color, "#1f2937");
    return {
      hair,
      skin,
      outfit,
      accent: config.outfit_type === "dress" ? "#ffffff" : colorValue(config.tie_color, "#f06a5f"),
      legs: config.outfit_type === "dress" ? "#202235" : colorValue(config.suit_color, "#1f2937"),
      dressLike: config.outfit_type === "dress",
      longHair: config.hair_length === "long",
    };
  }
  const option = getCaptainSpriteOption(value);
  return {
    hair: option.hair,
    skin: option.skin,
    outfit: option.outfit,
    accent: option.accent,
    legs: option.legs,
    dressLike: ["dress", "skirt", "kimono"].includes(option.value),
    longHair: false,
  };
};

const CaptainSpritePreview = ({ value, config, size = "md" }: { value?: CaptainsSpriteStyle | null; config?: CaptainsSpriteConfig | null; size?: "sm" | "md" }) => {
  const option = getSpriteColors(value, config);
  const scale = size === "sm" ? "h-12 w-9" : "h-16 w-12";
  return (
    <div className={`relative shrink-0 ${scale}`} style={{ imageRendering: "pixelated" }}>
      <div className="absolute left-[28%] top-[2%] h-[10%] w-[44%]" style={{ backgroundColor: option.hair }} />
      <div className="absolute left-[20%] top-[10%] h-[16%] w-[60%]" style={{ backgroundColor: option.hair }} />
      {option.longHair ? <div className="absolute left-[12%] top-[20%] h-[26%] w-[76%]" style={{ backgroundColor: option.hair }} /> : null}
      <div className="absolute left-[25%] top-[18%] h-[18%] w-[50%]" style={{ backgroundColor: option.skin }} />
      <div className="absolute left-[35%] top-[25%] h-[4%] w-[6%] bg-[#111111]" />
      <div className="absolute right-[35%] top-[25%] h-[4%] w-[6%] bg-[#111111]" />
      <div className="absolute left-[40%] top-[32%] h-[3%] w-[20%] bg-[#d25f5f]" />
      <div className="absolute left-[24%] top-[39%] h-[30%] w-[52%]" style={{ backgroundColor: option.outfit }} />
      <div className="absolute left-[43%] top-[39%] h-[30%] w-[14%]" style={{ backgroundColor: option.accent }} />
      <div className="absolute left-[10%] top-[42%] h-[24%] w-[14%]" style={{ backgroundColor: option.skin }} />
      <div className="absolute right-[10%] top-[42%] h-[24%] w-[14%]" style={{ backgroundColor: option.skin }} />
      {option.dressLike ? (
        <div className="absolute left-[18%] top-[66%] h-[16%] w-[64%]" style={{ backgroundColor: option.outfit }} />
      ) : null}
      <div className="absolute bottom-[5%] left-[28%] h-[28%] w-[16%]" style={{ backgroundColor: option.legs }} />
      <div className="absolute bottom-[5%] right-[28%] h-[28%] w-[16%]" style={{ backgroundColor: option.legs }} />
      <div className="absolute bottom-0 left-[25%] h-[5%] w-[22%] bg-[#111111]" />
      <div className="absolute bottom-0 right-[25%] h-[5%] w-[22%] bg-[#111111]" />
    </div>
  );
};

const CaptainPhotoPreview = ({
  table,
  size = "md",
}: {
  table: Pick<CaptainsTable, "table_number" | "table_name" | "captain_name" | "active_captain_name" | "captain_photo_url"> | {
    table_number: number;
    table_name: string;
    captain_name?: string | null;
    active_captain_name?: string | null;
    captain_photo_url?: string | null;
  };
  size?: "sm" | "md";
}) => {
  const scale = size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const name = table.captain_name || table.active_captain_name || table.table_name;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || String(table.table_number || "?");

  return table.captain_photo_url ? (
    <img src={table.captain_photo_url} alt="" className={`${scale} shrink-0 rounded-full border border-border object-cover`} />
  ) : (
    <div className={`${scale} flex shrink-0 items-center justify-center rounded-full border border-dashed border-border bg-muted text-sm font-semibold text-muted-foreground`}>
      {initials}
    </div>
  );
};

const EMPTY_CHALLENGE: CaptainsChallengeInput = {
  title: "",
  description: "",
  evidence_type: "photo",
  points: 10,
  category: "",
  difficulty: "easy",
  has_time_limit: false,
  time_limit_seconds: null,
  question_options: ["", "", "", ""],
  question_correct_option: "",
};

type CaptainPhotoCropState = {
  index: number;
  file: File;
  previewUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
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
  question: "Pregunta",
};

const difficultyLabels: Record<CaptainsDifficulty, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
  special: "Especial",
};

const challengeTemplateHeaders = [
  "title",
  "description",
  "evidence_type",
  "category",
  "difficulty",
  "points",
  "has_time_limit",
  "time_limit_seconds",
  "is_required",
  "question_options",
  "question_correct_option",
];

const challengeTemplateExample = [
  "Foto con alguien de otra mesa",
  "Haced una foto con una persona invitada de otra mesa.",
  "photo",
  "Interacción",
  "medium",
  "15",
  "false",
  "",
  "false",
  "",
  "",
];

const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseCsvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
};

const csvToChallenges = (text: string): CaptainsChallengeInput[] => {
  const rows = parseCsvRows(text);
  if (rows.length <= 1) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexOf = (name: string) => headers.indexOf(name);
  const get = (row: string[], name: string) => row[indexOf(name)] || "";

  return rows
    .slice(1)
    .map((row, index) => {
      const evidenceType = get(row, "evidence_type") as CaptainsEvidenceType;
      const difficulty = get(row, "difficulty") as CaptainsDifficulty;
      const hasTimeLimit = ["true", "1", "yes", "si", "sí"].includes(get(row, "has_time_limit").toLowerCase());
      const timeLimit = Number(get(row, "time_limit_seconds"));
      const questionOptions = get(row, "question_options").split("|").map((option) => option.trim()).filter(Boolean);
      const questionCorrectOption = get(row, "question_correct_option").trim();
      return {
        title: get(row, "title").trim(),
        description: get(row, "description").trim(),
        evidence_type: ["photo", "video", "question"].includes(evidenceType) ? evidenceType : "photo",
        points: Math.max(1, Number(get(row, "points")) || 10),
        category: get(row, "category").trim() || "Importado",
        difficulty: ["easy", "medium", "hard", "special"].includes(difficulty) ? difficulty : "easy",
        has_time_limit: hasTimeLimit,
        time_limit_seconds: hasTimeLimit ? Math.max(1, timeLimit || 60) : null,
        question_options: evidenceType === "question" ? questionOptions : null,
        question_correct_option: evidenceType === "question" ? questionCorrectOption || questionOptions[0] || "" : null,
        order_index: index + 1,
        is_required: ["true", "1", "yes", "si", "sí"].includes(get(row, "is_required").toLowerCase()),
      };
    })
    .filter((challenge) => challenge.title && challenge.description);
};

const isUuidValue = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const catalogChallengeToInput = (item: CaptainsChallengeCatalogItem, orderIndex: number): CaptainsChallengeInput => ({
  catalog_challenge_id: isUuidValue(item.id) ? item.id : null,
  title: item.title,
  description: item.description,
  evidence_type: item.evidence_type,
  points: item.default_points,
  category: item.category,
  difficulty: item.difficulty,
  has_time_limit: item.has_time_limit,
  time_limit_seconds: item.time_limit_seconds,
  question_options: item.question_options ?? null,
  question_correct_option: item.question_correct_option ?? null,
  order_index: orderIndex,
  is_required: false,
});

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

const dateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const timeInputValue = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const splitDateTimeInput = (value?: string | null) => {
  const fallback = new Date();
  const date = value ? new Date(value) : fallback;
  const valid = Number.isNaN(date.getTime()) ? fallback : date;
  return { date: dateInputValue(valid), time: timeInputValue(valid) };
};

const getDefaultCaptainsDateRange = () => {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    startDate: dateInputValue(start),
    startTime: timeInputValue(start),
    endDate: dateInputValue(end),
    endTime: timeInputValue(end),
  };
};

const dateTimePartsToIso = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return null;
  const date = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const loadImageElement = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });

const createCircularCaptainPhotoBlob = async (crop: CaptainPhotoCropState) => {
  const image = await loadImageElement(crop.previewUrl);
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const baseScale = Math.max(size / image.width, size / image.height);
  const scale = baseScale * crop.zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (crop.offsetX / 100) * size;
  const offsetY = (crop.offsetY / 100) * size;
  const x = (size - drawWidth) / 2 + offsetX;
  const y = (size - drawHeight) / 2 + offsetY;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create image blob"));
    }, "image/png");
  });
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
          <option value="question">Pregunta</option>
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
      {challenge.evidence_type === "question" && (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3 md:col-span-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Opciones de respuesta</p>
            <p className="text-xs text-muted-foreground">Marca cuál será la respuesta correcta para puntuar automáticamente.</p>
          </div>
          {(challenge.question_options?.length ? challenge.question_options : ["", "", "", ""]).map((option, optionIndex) => {
            const options = challenge.question_options?.length ? challenge.question_options : ["", "", "", ""];
            const optionValue = option || `Opción ${optionIndex + 1}`;
            const checked = challenge.question_correct_option === option;
            return (
              <div key={optionIndex} className="grid grid-cols-[auto_1fr] items-center gap-2">
                <input
                  type="radio"
                  name={`question-correct-${index}`}
                  checked={checked}
                  onChange={() => onChange({ ...challenge, question_correct_option: option })}
                  className="h-4 w-4 accent-primary"
                />
                <Input
                  value={option}
                  placeholder={optionValue}
                  onChange={(event) => {
                    const nextOptions = [...options];
                    const previousValue = nextOptions[optionIndex];
                    nextOptions[optionIndex] = event.target.value;
                    onChange({
                      ...challenge,
                      question_options: nextOptions,
                      question_correct_option: challenge.question_correct_option === previousValue ? event.target.value : challenge.question_correct_option,
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
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
  const isUsingLocalCatalog = catalog.some((challenge) => challenge.id.startsWith("default-"));
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [tableCount, setTableCount] = useState(0);
  const [captains, setCaptains] = useState<
    Array<{
      id?: string;
      table_number: number;
      table_name: string;
      captain_name: string;
      captain_photo_url: string;
      captain_sprite: CaptainsSpriteStyle;
      captain_sprite_config: CaptainsSpriteConfig;
    }>
  >([]);
  const [uploadingCaptainPhotoIndex, setUploadingCaptainPhotoIndex] = useState<number | null>(null);
  const [captainPhotoCrop, setCaptainPhotoCrop] = useState<CaptainPhotoCropState | null>(null);
  const defaultDateRange = useMemo(() => getDefaultCaptainsDateRange(), []);
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [startHour, setStartHour] = useState(defaultDateRange.startTime);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [endHour, setEndHour] = useState(defaultDateRange.endTime);
  const [scoringMode, setScoringMode] = useState<"automatic" | "manual">("automatic");
  const [showLiveGalleryAfterCompletion, setShowLiveGalleryAfterCompletion] = useState(true);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [selectedChallenges, setSelectedChallenges] = useState<CaptainsChallengeInput[]>([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
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
        captain_photo_url: table.captain_photo_url || "",
        captain_sprite: table.captain_sprite || getDefaultCaptainSprite(table.table_number - 1),
        captain_sprite_config: normalizeCaptainSpriteConfig(table.captain_sprite_config, table.table_number - 1),
      })),
    );
    const startParts = splitDateTimeInput(detail.event.start_time);
    const endParts = splitDateTimeInput(detail.event.end_time);
    setStartDate(startParts.date);
    setStartHour(startParts.time);
    setEndDate(endParts.date);
    setEndHour(endParts.time);
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
        question_options: challenge.question_options ?? ["", "", "", ""],
        question_correct_option: challenge.question_correct_option ?? "",
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
            captain_photo_url: "",
            captain_sprite: getDefaultCaptainSprite(index),
            captain_sprite_config: defaultCaptainSpriteConfig(index),
          }
        );
      }).map((table, index) => ({
        ...table,
        table_number: index + 1,
        table_name: table.table_name || `Mesa ${index + 1}`,
        captain_photo_url: table.captain_photo_url || "",
        captain_sprite: table.captain_sprite || getDefaultCaptainSprite(index),
        captain_sprite_config: normalizeCaptainSpriteConfig(table.captain_sprite_config, index),
      })),
    );
  };

  const validateStepOne = () => {
    if (!name.trim()) return "El nombre del evento es obligatorio.";
    if (tableCount <= 0 || captains.length === 0) return "Añade al menos una mesa para crear el juego.";
    if (!startDate || !startHour) return "Elige el día y la hora de inicio.";
    if (!endDate || !endHour) return "Elige el día y la hora de fin.";
    const startDateTime = new Date(`${startDate}T${startHour}`);
    const endDateTime = new Date(`${endDate}T${endHour}`);
    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) return "Revisa el día y la hora de inicio y fin.";
    if (endDateTime <= startDateTime) return "La fecha de fin debe ser posterior a la fecha de inicio.";
    return null;
  };

  const validateChallenges = () => {
    if (selectedChallenges.length === 0) return "No se puede crear evento sin retos.";
    for (const challenge of selectedChallenges) {
      if (!challenge.title.trim() || !challenge.description.trim()) return "Cada reto debe tener título y descripción.";
      if (!challenge.evidence_type) return "Cada reto debe tener evidencia.";
      if (!challenge.points || challenge.points <= 0) return "Cada reto debe tener puntos.";
      if (challenge.evidence_type === "question") {
        const options = (challenge.question_options || []).map((option) => option.trim()).filter(Boolean);
        if (options.length < 2) return "Cada pregunta debe tener al menos dos opciones.";
        if (!challenge.question_correct_option || !options.includes(challenge.question_correct_option.trim())) {
          return "Cada pregunta debe tener una respuesta correcta marcada.";
        }
      }
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

  const catalogByCategory = useMemo(() => {
    const groups = new Map<string, CaptainsChallengeCatalogItem[]>();
    catalog.forEach((challenge) => {
      const key = challenge.category || "General";
      groups.set(key, [...(groups.get(key) || []), challenge]);
    });
    return Array.from(groups.entries()).sort(([first], [second]) => first.localeCompare(second, "es"));
  }, [catalog]);

  const toggleCatalogChallenge = (catalogId: string) => {
    setSelectedCatalogIds((prev) =>
      prev.includes(catalogId) ? prev.filter((id) => id !== catalogId) : [...prev, catalogId],
    );
  };

  const addSelectedCatalogChallenges = () => {
    const items = selectedCatalogIds
      .map((catalogId) => catalog.find((challenge) => challenge.id === catalogId))
      .filter(Boolean) as CaptainsChallengeCatalogItem[];
    if (items.length === 0) return;
    setSelectedChallenges((prev) => [
      ...prev,
      ...items.map((item, index) => catalogChallengeToInput(item, prev.length + index + 1)),
    ]);
    setSelectedCatalogIds([]);
  };

  const downloadChallengeTemplate = () => {
    const csv = [
      challengeTemplateHeaders.map(escapeCsvValue).join(","),
      challengeTemplateExample.map(escapeCsvValue).join(","),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-retos-capitanes.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportChallenges = async (file?: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = csvToChallenges(text);
      if (imported.length === 0) {
        toast({ title: "Archivo sin retos", description: "Revisa que el CSV tenga cabeceras y al menos un reto válido.", variant: "destructive" });
        return;
      }
      setSelectedChallenges((prev) => [
        ...prev,
        ...imported.map((challenge, index) => ({ ...challenge, order_index: prev.length + index + 1 })),
      ]);
      toast({ title: "Retos importados", description: `Se han añadido ${imported.length} retos al evento.` });
    } catch (error) {
      console.error("Challenge import error:", error);
      toast({ title: "Error al importar", description: "No hemos podido leer el archivo CSV.", variant: "destructive" });
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleCaptainPhotoSelected = (index: number, file?: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCaptainPhotoCrop({ index, file, previewUrl, zoom: 1, offsetX: 0, offsetY: 0 });
  };

  const closeCaptainPhotoCrop = () => {
    if (captainPhotoCrop?.previewUrl) URL.revokeObjectURL(captainPhotoCrop.previewUrl);
    setCaptainPhotoCrop(null);
  };

  const handleCaptainPhotoUpload = async () => {
    if (!captainPhotoCrop) return;
    try {
      setUploadingCaptainPhotoIndex(captainPhotoCrop.index);
      const blob = await createCircularCaptainPhotoBlob(captainPhotoCrop);
      const cleanName = sanitizeCaptainPhotoName(captainPhotoCrop.file.name.replace(/\.[^.]+$/, ""));
      const filePath = `captains/captain-photos/${eventId || "new"}/${Date.now()}-${captainPhotoCrop.index + 1}-${cleanName}.png`;
      const { error } = await supabase.storage.from("event-photos").upload(filePath, blob, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(filePath);
      setCaptains((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === captainPhotoCrop.index ? { ...item, captain_photo_url: data.publicUrl } : item,
        ),
      );
      closeCaptainPhotoCrop();
      toast({ title: "Foto subida", description: "La foto del capitán se ha añadido a la mesa." });
    } catch (error) {
      console.error("Captain photo upload error:", error);
      toast({ title: "Error", description: "No hemos podido subir la foto del capitán.", variant: "destructive" });
    } finally {
      setUploadingCaptainPhotoIndex(null);
    }
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
      const startIso = dateTimePartsToIso(startDate, startHour);
      const endIso = dateTimePartsToIso(endDate, endHour);
      const eventPayload = {
        name: name.trim(),
        description: description.trim(),
        start_time: startIso,
        end_time: endIso,
        scoring_mode: scoringMode,
        show_live_gallery_after_completion: showLiveGalleryAfterCompletion,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        background_image_url: backgroundImageUrl.trim() || null,
        status: startIso && new Date(startIso).getTime() > Date.now() ? "scheduled" as const : "active" as const,
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
    <>
    <AdminFrame title={edit ? "Editar juego de Capitanes" : "Nuevo juego de Capitanes"} subtitle={`Paso ${step} de 2`}>
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
                <span className="text-sm font-medium">Estilo visual del juego mobile</span>
                <p className="text-xs text-muted-foreground">
                  La experiencia pública usa fondo blanco, estética pixel art brutalista y el color principal para los CTA.
                </p>
              </div>
              <label className="space-y-1">
                <span className="text-sm font-medium">Color principal de CTAs</span>
                <div className="flex gap-2">
                  <Input type="color" value={isHexColor(primaryColor) ? primaryColor : DEFAULT_PRIMARY_COLOR} onChange={(event) => setPrimaryColor(event.target.value)} className="h-10 w-14 p-1" />
                  <Input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} placeholder={DEFAULT_PRIMARY_COLOR} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Color secundario</span>
                <div className="flex gap-2">
                  <Input type="color" value={isHexColor(secondaryColor) ? secondaryColor : DEFAULT_SECONDARY_COLOR} onChange={(event) => setSecondaryColor(event.target.value)} className="h-10 w-14 p-1" />
                  <Input value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} placeholder={DEFAULT_SECONDARY_COLOR} />
                </div>
              </label>
              <div className="rounded-md border-2 border-black bg-white p-4 md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Vista previa</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Fondo blanco, borde negro y CTA con color principal.</p>
                  </div>
                  <CaptainSpritePreview
                    value={captains[0]?.captain_sprite || "suit"}
                    config={captains[0]?.captain_sprite_config || defaultCaptainSpriteConfig(0)}
                  />
                </div>
                <div className="mt-4 inline-flex rounded-none border-2 border-black px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>
                  Hacer foto
                </div>
              </div>
            </div>
            <label className="space-y-1">
              <span className="text-sm font-medium">Número de mesas</span>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={tableCount || ""}
                onChange={(event) => syncTableCount(Number(event.target.value))}
                className="w-24 text-center"
              />
            </label>
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Fecha de inicio</span>
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Hora</span>
                  <Input type="time" value={startHour} onChange={(event) => setStartHour(event.target.value)} />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <label className="space-y-1">
                  <span className="text-sm font-medium">Fecha de fin</span>
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Hora</span>
                  <Input type="time" value={endHour} onChange={(event) => setEndHour(event.target.value)} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">Al llegar esta hora, se podrá ver el resumen con los equipos que hayan participado.</p>
            </div>
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
              {captains.map((table, index) => {
                const updateSpriteConfig = (patch: Partial<CaptainsSpriteConfig>) => {
                  setCaptains((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, captain_sprite_config: { ...item.captain_sprite_config, ...patch } }
                        : item,
                    ),
                  );
                };
                return (
                  <div key={index} className="space-y-3 rounded-md border border-border bg-background p-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <CaptainPhotoPreview table={table} />
                        <CaptainSpritePreview value={table.captain_sprite} config={table.captain_sprite_config} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Mesa {index + 1}</p>
                        <p className="text-xs text-muted-foreground">Jefe/a de mesa pixel art</p>
                      </div>
                    </div>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Capitán/a</span>
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
                    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-muted-foreground">Foto del capitán/a</span>
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
                          {uploadingCaptainPhotoIndex === index ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                          {uploadingCaptainPhotoIndex === index ? "Subiendo..." : "Subir foto"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              handleCaptainPhotoSelected(index, event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {table.captain_photo_url ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2"
                          onClick={() =>
                            setCaptains((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, captain_photo_url: "" } : item,
                              ),
                            )
                          }
                        >
                          <X className="h-3.5 w-3.5" />
                          Quitar foto
                        </Button>
                      ) : (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <ImageIcon className="h-3.5 w-3.5" />
                          Solo se verá en la selección de mesa.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Sexo</span>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={table.captain_sprite_config.sex}
                          onChange={(event) => {
                            const sex = event.target.value as CaptainsSpriteConfig["sex"];
                            updateSpriteConfig({ sex, outfit_type: sex === "female" ? "dress" : "suit" });
                          }}
                        >
                          <option value="male">Hombre</option>
                          <option value="female">Mujer</option>
                          <option value="unspecified">Prefiero no decirlo</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Pelo</span>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={table.captain_sprite_config.hair_length} onChange={(event) => updateSpriteConfig({ hair_length: event.target.value as CaptainsSpriteConfig["hair_length"] })}>
                          <option value="short">Corto</option>
                          <option value="long">Largo</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Color pelo</span>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={table.captain_sprite_config.hair_color} onChange={(event) => updateSpriteConfig({ hair_color: event.target.value as CaptainsSpriteConfig["hair_color"] })}>
                          {hairColorOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Color piel</span>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={table.captain_sprite_config.skin_color} onChange={(event) => updateSpriteConfig({ skin_color: event.target.value as CaptainsSpriteConfig["skin_color"] })}>
                          {skinColorOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Vestuario</span>
                        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={table.captain_sprite_config.outfit_type} onChange={(event) => updateSpriteConfig({ outfit_type: event.target.value as CaptainsSpriteConfig["outfit_type"] })}>
                          <option value="dress">Vestido</option>
                          <option value="suit">Traje</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Color vestido</span>
                        <Input
                          type="color"
                          value={colorValue(table.captain_sprite_config.dress_color, "#202235")}
                          onChange={(event) => updateSpriteConfig({ dress_color: event.target.value })}
                          className="h-10"
                          disabled={table.captain_sprite_config.outfit_type !== "dress"}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Color traje</span>
                        <Input
                          type="color"
                          value={colorValue(table.captain_sprite_config.suit_color, "#1f2937")}
                          onChange={(event) => updateSpriteConfig({ suit_color: event.target.value })}
                          className="h-10"
                          disabled={table.captain_sprite_config.outfit_type !== "suit"}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Color corbata</span>
                        <Input
                          type="color"
                          value={colorValue(table.captain_sprite_config.tie_color, "#f06a5f")}
                          onChange={(event) => updateSpriteConfig({ tie_color: event.target.value })}
                          className="h-10"
                          disabled={table.captain_sprite_config.outfit_type !== "suit"}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleContinue}>Continuar</Button>
          </div>
        </Card>
      ) : (
        <div className="relative -mx-4 h-[calc(100vh-150px)] min-h-[560px] overflow-hidden px-4 pb-24">
          <div className="grid h-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-5 lg:grid-cols-[340px_1fr] lg:grid-rows-none">
            <Card className="flex min-h-0 flex-col space-y-4 overflow-hidden p-4">
            <div>
              <h2 className="font-semibold">Catálogo de retos</h2>
              <p className="text-sm text-muted-foreground">Selecciona cuántos y cuáles quieres incluir en este evento.</p>
            </div>
            {isUsingLocalCatalog ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Mostrando catálogo precargado local. Para verlo desde Supabase, aplica la migración del catálogo.
              </div>
            ) : null}
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedCatalogIds.length} retos seleccionados</p>
              <p className="text-xs text-muted-foreground">{selectedChallenges.length} retos añadidos al evento</p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {catalogByCategory.map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <div className="sticky top-0 z-10 bg-card py-1">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{category}</p>
                  </div>
                  {items.map((challenge) => {
                    const checked = selectedCatalogIds.includes(challenge.id);
                    return (
                      <label
                        key={challenge.id}
                        className={`flex cursor-pointer gap-3 rounded-md border p-3 transition-colors ${
                          checked ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCatalogChallenge(challenge.id)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{challenge.title}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {evidenceLabels[challenge.evidence_type]} · {challenge.default_points} pts · {difficultyLabels[challenge.difficulty]}
                            {challenge.has_time_limit ? ` · ${challenge.time_limit_seconds}s` : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
            <Button className="w-full gap-2" onClick={addSelectedCatalogChallenges} disabled={selectedCatalogIds.length === 0}>
              <Check className="h-4 w-4" />
              Añadir seleccionados
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-2" onClick={() => importInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Importar
              </Button>
              <Button variant="outline" className="gap-2" onClick={downloadChallengeTemplate}>
                <Download className="h-4 w-4" />
                Descargar plantilla
              </Button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleImportChallenges(event.target.files?.[0])}
            />
            <Button variant="outline" className="w-full gap-2" onClick={() => setSelectedChallenges((prev) => [...prev, { ...EMPTY_CHALLENGE }])}>
              <Plus className="h-4 w-4" />
              Crear reto nuevo
            </Button>
          </Card>

            <div className="min-h-0 overflow-y-auto pr-1">
              <div className="space-y-4 pb-2">
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
              </div>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col-reverse gap-2 sm:flex-row sm:justify-between">
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
    <Dialog open={Boolean(captainPhotoCrop)} onOpenChange={(open) => { if (!open) closeCaptainPhotoCrop(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustar foto del capitán</DialogTitle>
          <DialogDescription>Encaja la imagen dentro del marco circular antes de guardarla.</DialogDescription>
        </DialogHeader>
        {captainPhotoCrop ? (
          <div className="space-y-5">
            <div className="mx-auto flex h-72 w-72 items-center justify-center overflow-hidden rounded-full border-4 border-foreground bg-muted">
              <img
                src={captainPhotoCrop.previewUrl}
                alt=""
                className="h-full w-full object-cover"
                style={{
                  transform: `translate(${captainPhotoCrop.offsetX}%, ${captainPhotoCrop.offsetY}%) scale(${captainPhotoCrop.zoom})`,
                  transformOrigin: "center",
                }}
              />
            </div>
            <div className="grid gap-3">
              <label className="space-y-1">
                <span className="text-sm font-medium">Zoom</span>
                <Input
                  type="range"
                  min="1"
                  max="2.6"
                  step="0.05"
                  value={captainPhotoCrop.zoom}
                  onChange={(event) => setCaptainPhotoCrop((prev) => prev ? { ...prev, zoom: Number(event.target.value) } : prev)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Mover horizontal</span>
                <Input
                  type="range"
                  min="-35"
                  max="35"
                  step="1"
                  value={captainPhotoCrop.offsetX}
                  onChange={(event) => setCaptainPhotoCrop((prev) => prev ? { ...prev, offsetX: Number(event.target.value) } : prev)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium">Mover vertical</span>
                <Input
                  type="range"
                  min="-35"
                  max="35"
                  step="1"
                  value={captainPhotoCrop.offsetY}
                  onChange={(event) => setCaptainPhotoCrop((prev) => prev ? { ...prev, offsetY: Number(event.target.value) } : prev)}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeCaptainPhotoCrop}>Cancelar</Button>
              <Button onClick={handleCaptainPhotoUpload} disabled={uploadingCaptainPhotoIndex === captainPhotoCrop.index}>
                {uploadingCaptainPhotoIndex === captainPhotoCrop.index ? "Subiendo..." : "Guardar encuadre"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
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
  return <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">Sin preview</div>;
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
  const publicUrl = normalizeCaptainsPublicUrl(event.public_url, event.slug);
  const qrValue = normalizeCaptainsPublicUrl(event.qr_url || getCaptainsQrValue(event.slug), event.slug);
  const visibleEvidence = view === "review" ? reviewEvidence : evidence;
  const liveVisibleEvidence = evidence.filter((item) => item.file_url && !["deleted", "rejected"].includes(item.status));
  const photoCount = liveVisibleEvidence.filter((item) => item.evidence_type === "photo").length;
  const videoCount = liveVisibleEvidence.filter((item) => item.evidence_type === "video").length;
  const questionCount = challenges.filter((item) => item.evidence_type === "question").length;
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
                <Info label="Estilo" value="Pixel art brutalista" />
                <Info label="Color CTA" value={event.primary_color || DEFAULT_PRIMARY_COLOR} />
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
            <Info label="Preguntas" value={String(questionCount)} />
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
            <th className="py-3 pr-4 font-medium">Estética</th>
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
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <CaptainPhotoPreview table={table} size="sm" />
                    <CaptainSpritePreview value={table.captain_sprite} config={table.captain_sprite_config} size="sm" />
                    {table.captain_sprite_config?.outfit_type === "dress" ? "Vestido" : "Traje"}
                  </div>
                </td>
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
              <th className="py-3 pr-4 font-medium">Estética</th>
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
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <CaptainPhotoPreview table={table} size="sm" />
                      <CaptainSpritePreview value={table.captain_sprite} config={table.captain_sprite_config} size="sm" />
                      {table.captain_sprite_config?.outfit_type === "dress" ? "Vestido" : "Traje"}
                    </div>
                  </td>
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
