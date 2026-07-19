import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Flag,
  Gamepad2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Video,
  X,
  Camera,
  Upload,
  User,
  Image as ImageIcon,
  KeyRound,
  MessageSquareText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  captainsQueryKeys,
  useCaptainsChallengeCatalog,
  useCaptainsEventDetail,
  useCaptainsEvents,
  useCaptainsRanking,
} from "@/hooks/useCaptains";
import { captainsDefaultChallengeCatalog } from "@/lib/captainsDefaultChallengeCatalog";
import {
  approveCaptainsEvidence,
  addCatalogChallengesToCaptainsEvent,
  CAPTAINS_MAX_CHALLENGES,
  createCustomCaptainsChallenge,
  deleteCaptainsEvent,
  createCaptainsGame,
  deleteCaptainsEvidence,
  getCaptainsEvidence,
  getCaptainsEvidenceGroup,
  getCaptainsEvidenceIndex,
  getCaptainsEvidenceSignedUrl,
  getCaptainsTableChallenges,
  rejectCaptainsEvidence,
  replaceCaptainsEventChallenges,
  resetAllCaptainsTables,
  resetCaptainsTableLastActivity,
  updateCaptainsEventChallenge,
  updateCaptainsEvidence,
  updateCaptainsEvent,
  updateCaptainsTable,
  updateCaptainsTables,
} from "@/lib/captainsService";
import { normalizeCaptainsPublicUrl, resolveCaptainsQrImageUrl } from "@/lib/captainsUtils";
import type {
  CaptainsChallengeInput,
  CaptainsChallengeCatalogItem,
  CaptainsDifficulty,
  CaptainsEvent,
	  CaptainsEventChallenge,
	  CaptainsEventDetail,
	  CaptainsEvidence,
	  CaptainsEvidenceType,
	  CaptainsRankingItem,
	  CaptainsSpriteConfig,
  CaptainsSpriteStyle,
  CaptainsThemeStyle,
  CaptainsTable,
  CaptainsTableChallenge,
} from "@/lib/captainsTypes";

const DEFAULT_DESCRIPTION =
  "Bienvenidos a Capitanes by Revelao.\nCada mesa tendrá un capitán encargado de guiar a su equipo durante el juego.\nTendréis que completar retos, subir pruebas y competir contra el resto de mesas.\nPreparad la cámara, afinad la voz y jugad en equipo.\nQue empiece la misión.";
const DEFAULT_PRIMARY_COLOR = "#f06a5f";
const DEFAULT_SECONDARY_COLOR = "#2f292d";
const CAPTAINS_DEMO_SLUG = "demo-capitanes";
const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
const colorValue = (value: string, fallback: string) => (isHexColor(value) ? value : fallback);
const readableTextColor = (background: string) => {
  const safeBackground = colorValue(background, DEFAULT_PRIMARY_COLOR).replace("#", "");
  const r = parseInt(safeBackground.slice(0, 2), 16);
  const g = parseInt(safeBackground.slice(2, 4), 16);
  const b = parseInt(safeBackground.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145 ? "#111827" : "#ffffff";
};
const sanitizeCaptainPhotoName = (value: string) => value.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "captain-photo";
const isCaptainsEventFinished = (event: Pick<CaptainsEvent, "end_time">) =>
  Boolean(event.end_time && new Date(event.end_time).getTime() <= Date.now());

const captainsThemeOptions: Array<{
  value: CaptainsThemeStyle;
  label: string;
  description: string;
  headingClass: string;
  previewClass: string;
}> = [
  {
    value: "pixel",
    label: "Pixel art",
    description: "Borde negro, estética arcade y tipografía pixelada.",
    headingClass: "font-mono uppercase",
    previewClass: "rounded-none border-2 border-black bg-white",
  },
  {
    value: "romantic",
    label: "Romántico",
    description: "Tipografía cursiva, bordes suaves y una sensación más elegante.",
    headingClass: "font-serif italic",
    previewClass: "rounded-2xl border border-neutral-200 bg-white",
  },
  {
    value: "modern",
    label: "Moderno",
    description: "Palo seco, peso fuerte tipo Arial Black y controles limpios.",
    headingClass: "font-sans uppercase",
    previewClass: "rounded-lg border-2 border-neutral-900 bg-neutral-50",
  },
  {
    value: "classic",
    label: "Clásico",
    description: "Serif editorial, elegante y sobrio para celebraciones formales.",
    headingClass: "font-serif",
    previewClass: "rounded-xl border border-stone-300 bg-white",
  },
];

const getCaptainsThemeOption = (value?: CaptainsThemeStyle | null) =>
  captainsThemeOptions.find((option) => option.value === value) || captainsThemeOptions[0];

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
type CaptainsDetailTab = "general" | "tables" | "challenges" | "content";

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

const finishedTableChallengeStatuses = new Set<CaptainsTableChallenge["status"]>([
  "completed",
  "failed",
  "time_expired",
  "pending_review",
  "rejected",
  "deleted",
]);

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
  // Catalog challenges start without a timer in every new event. Organizers can
  // opt in and configure a duration later from the challenge editor.
  has_time_limit: false,
  time_limit_seconds: null,
  question_options: item.question_options ?? null,
  question_correct_option: item.question_correct_option ?? null,
  order_index: orderIndex,
  is_required: false,
});

const eventChallengeToInput = (challenge: CaptainsEventChallenge): CaptainsChallengeInput => ({
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

const useRequireAdmin = (disabled = false) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (disabled) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/admin-login");
    });
  }, [disabled, navigate]);
};

const AdminFrame = ({
  title,
  subtitle,
  actions,
  backAction,
  hideUtilityActions = false,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backAction?: () => void;
  hideUtilityActions?: boolean;
  children: React.ReactNode;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accountOpen, setAccountOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [marketingSaving, setMarketingSaving] = useState(false);
  const canSwitchProduct = currentUserEmail?.trim().toLowerCase() === "revelao.cam@gmail.com";

  useEffect(() => {
    const loadUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      setCurrentUserEmail(user?.email ?? null);
      if (!user?.id) return;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("marketing_opt_in")
        .eq("id", user.id)
        .maybeSingle();
      setMarketingOptIn(profile?.marketing_opt_in ?? true);
    };
    loadUserEmail();
  }, []);

  const handleMarketingToggle = async (checked: boolean) => {
    if (!currentUserId) return;
    try {
      setMarketingSaving(true);
      const { error } = await supabase
        .from("user_profiles")
        .upsert({ id: currentUserId, marketing_opt_in: checked }, { onConflict: "id" });
      if (error) throw error;
      setMarketingOptIn(checked);
      toast({ title: "Preferencias guardadas", description: "Se actualizó tu preferencia de comunicaciones comerciales." });
    } catch (error) {
      console.error("Error updating marketing preference:", error);
      toast({ title: "Error", description: "No se pudo actualizar la preferencia.", variant: "destructive" });
    } finally {
      setMarketingSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      localStorage.removeItem("isDemoMode");
      localStorage.removeItem("adminEventId");
      navigate("/admin-login", { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm("¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
      if (error) throw error;
      await supabase.auth.signOut();
      localStorage.removeItem("isDemoMode");
      localStorage.removeItem("adminEventId");
      navigate("/admin-login", { replace: true });
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({ title: "Error", description: "No se pudo eliminar la cuenta.", variant: "destructive" });
    }
  };

  return (
    <div className="admin-demo2-shell min-h-screen bg-background p-4 md:p-6" data-scroll-container>
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {backAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={backAction}
                    aria-label="Volver"
                    title="Volver"
                    className="shrink-0 rounded-full"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                ) : null}
                <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl" data-scroll-anchor>{title}</h1>
              </div>
              {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {actions}
              {!hideUtilityActions ? (
                <>
                  {canSwitchProduct ? (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate("/event-management")}
                      aria-label="Eventos Revelao"
                      title="Eventos Revelao"
                      className="rounded-full font-bold"
                    >
                      <span className="text-sm leading-none">R</span>
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAccountOpen(true)}
                    aria-label="Cuenta"
                    className="rounded-full"
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <main className="space-y-6">{children}</main>
      </div>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="admin-demo2-shell max-w-sm w-[92vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Cuenta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {currentUserEmail || "-"}
            </div>
            <label className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={marketingOptIn}
                disabled={marketingSaving}
                onChange={(event) => handleMarketingToggle(event.target.checked)}
              />
              <span>
                Comunicaciones comerciales por email
                <span className="block text-xs text-muted-foreground">
                  Puedes activarlas o desactivarlas cuando quieras.
                </span>
              </span>
            </label>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setAccountOpen(false);
                navigate("/reset-password");
              }}
            >
              Reset contraseña
            </Button>
            <Button className="w-full" variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </Button>
            <Button className="w-full" variant="destructive" onClick={handleDeleteAccount}>
              Eliminar cuenta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <Card className="rounded-2xl p-10 text-center shadow-sm">
    <Gamepad2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">{text}</p>
  </Card>
);

export const CaptainsAdminList = () => {
  useRequireAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: events = [], isLoading, isError } = useCaptainsEvents();
  const [listTab, setListTab] = useState<"events" | "demo">("events");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "finished">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeTableCount, setCodeTableCount] = useState(6);
  const generateCreationCode = async () => {
    try {
      setIsGeneratingCode(true);
      setGeneratedCode(null);
      const { data, error } = await supabase.functions.invoke("admin-generate-captains-code", { body: { tableCount: codeTableCount } });
      if (error || !data?.code) throw error || new Error("NO_CODE");
      setGeneratedCode(data.code);
      toast({ title: "Código generado", description: `Permitirá crear un evento de hasta ${codeTableCount} mesas.` });
    } catch (error) {
      console.error("Error generating captains code:", error);
      toast({ title: "Error", description: "No se pudo generar el código.", variant: "destructive" });
    } finally {
      setIsGeneratingCode(false);
    }
  };
  const filteredEvents = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    return events.filter((event) => event.slug !== CAPTAINS_DEMO_SLUG).filter((event) => {
      const matchesSearch = !cleanSearch || [event.name, event.slug, event.description || ""].some((value) => value.toLowerCase().includes(cleanSearch));
      const displayStatus = isCaptainsEventFinished(event) ? "finished" : "in_progress";
      const matchesStatus = statusFilter === "all" || displayStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [events, search, statusFilter]);
  const statusCounts = useMemo(() => {
    const regularEvents = events.filter((event) => event.slug !== CAPTAINS_DEMO_SLUG);
    return regularEvents.reduce<Record<string, number>>((acc, event) => {
      const displayStatus = isCaptainsEventFinished(event) ? "finished" : "in_progress";
      acc[displayStatus] = (acc[displayStatus] || 0) + 1;
      return acc;
    }, { all: regularEvents.length });
  }, [events]);
  const demoEvent = events.find((event) => event.slug === CAPTAINS_DEMO_SLUG);
  const demoAdminIdentifier = demoEvent?.id || CAPTAINS_DEMO_SLUG;
  const toggleSelection = (eventId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };
  const deleteSelection = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`¿Eliminar ${selectedIds.size} evento(s) de Capitanes seleccionados?`);
    if (!confirmed) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteCaptainsEvent(id)));
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.events() });
      toast({ title: "Eventos eliminados", description: "La selección se ha eliminado correctamente." });
    } catch (error) {
      console.error("Error deleting captains selection:", error);
      toast({ title: "Error", description: "No hemos podido eliminar la selección.", variant: "destructive" });
    }
  };

  return (
    <AdminFrame
      title="Capitanes by Revelao"
      subtitle="Gestiona juegos de retos por mesas."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={() => navigate("/admin/capitanes/onboarding")}>
            <Plus className="h-4 w-4" />
            Nuevo Capitán
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setCodeDialogOpen(true)}>
            <KeyRound className="h-4 w-4" />
            Generar código
          </Button>
        </div>
      }
    >
	    <Tabs value={listTab} onValueChange={(value) => setListTab(value as "events" | "demo")} className="space-y-5">
	      <TabsList className="grid h-auto w-full grid-cols-2 !rounded-none bg-muted/50 p-1 sm:w-[320px]">
	        <TabsTrigger value="events" className="!rounded-none data-[state=active]:!bg-foreground data-[state=active]:!text-background">
	          Eventos
	        </TabsTrigger>
	        <TabsTrigger value="demo" className="!rounded-none data-[state=active]:!bg-foreground data-[state=active]:!text-background">
	          Demo
	        </TabsTrigger>
	      </TabsList>

	      <TabsContent value="events" className="mt-0 space-y-5">
	      <Card className="rounded-2xl p-4 shadow-sm">
	        <div className="flex flex-wrap gap-2">
	          {(["all", "in_progress", "finished"] as const).map((status) => (
	            <button
	              key={status}
	              type="button"
	              onClick={() => setStatusFilter(status)}
	              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
	                statusFilter === status ? "!border-foreground !bg-foreground !text-background shadow-sm" : "border-border bg-background text-foreground hover:bg-muted"
	              }`}
	            >
	              <span>{status === "all" ? "Todos" : status === "in_progress" ? "En curso" : "Terminado"}</span>
	              <span className={`rounded-full px-2 py-0.5 text-xs ${statusFilter === status ? "bg-background/20 !text-background" : "bg-muted text-muted-foreground"}`}>
	                {statusCounts[status] || 0}
	              </span>
	            </button>
	          ))}
	        </div>
	        <div className="mt-4">
	          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, slug o descripción" />
	        </div>
	        {selectedIds.size > 0 ? (
	          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
	            <p className="text-xs text-muted-foreground">{selectedIds.size} seleccionados</p>
	            <Button variant="destructive" size="sm" onClick={deleteSelection}>Eliminar selección</Button>
	          </div>
	        ) : null}
	      </Card>

	      <Card className="rounded-2xl p-4 shadow-sm">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Cargando juegos...</p>
        ) : isError ? (
          <p className="p-8 text-center text-sm text-destructive">No hemos podido cargar la información. Inténtalo de nuevo.</p>
	        ) : filteredEvents.length === 0 ? (
	          <EmptyState text="Todavía no has creado ningún juego de Capitanes." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
	                  <th className="py-3 pr-3 font-medium w-10"> </th>
	                  <th className="py-3 pr-4 font-medium">Evento</th>
                  <th className="py-3 pr-4 font-medium">Estado</th>
                  <th className="py-3 pr-4 font-medium">Creación</th>
                  <th className="py-3 pr-4 font-medium">Mesas</th>
                  <th className="py-3 pr-4 font-medium">Retos</th>
                  <th className="py-3 pr-4 font-medium">Puntuación</th>
                  <th className="py-3 pr-4 font-medium">Inicio</th>
                </tr>
              </thead>
              <tbody>
	                {filteredEvents.map((event) => (
	                  <tr
	                    key={event.id}
	                    role="link"
	                    tabIndex={0}
	                    className="cursor-pointer border-b transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none last:border-b-0"
	                    onClick={() => navigate(`/admin/capitanes/${event.id}`)}
	                    onKeyDown={(keyboardEvent) => {
	                      if (keyboardEvent.key === "Enter") navigate(`/admin/capitanes/${event.id}`);
	                    }}
	                  >
	                    <td className="py-3 pr-3">
	                      <input
	                        type="checkbox"
	                        checked={selectedIds.has(event.id)}
	                        onChange={() => toggleSelection(event.id)}
	                        onClick={(clickEvent) => clickEvent.stopPropagation()}
	                        onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
	                        className="h-4 w-4 accent-primary"
	                      />
	                    </td>
	                    <td className="py-3 pr-4 font-medium">{event.name}</td>
                    <td className="py-3 pr-4">
                      <Badge className="rounded-full" variant={isCaptainsEventFinished(event) ? "outline" : "default"}>
                        {isCaptainsEventFinished(event) ? "Terminado" : "En curso"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">{formatDateTime(event.created_at)}</td>
                    <td className="py-3 pr-4">{event.table_count}</td>
                    <td className="py-3 pr-4">{event.challenge_count}</td>
                    <td className="py-3 pr-4">{event.scoring_mode === "automatic" ? "Automática" : "Manual"}</td>
                    <td className="py-3 pr-4">{formatDateTime(event.start_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
	      </TabsContent>

	      <TabsContent value="demo" className="mt-0">
	        <Card
	          role="link"
	          tabIndex={0}
	          className="cursor-pointer rounded-2xl p-5 shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
	          onClick={() => navigate(`/admin/capitanes/${demoAdminIdentifier}`)}
	          onKeyDown={(keyboardEvent) => {
	            if (keyboardEvent.key === "Enter") navigate(`/admin/capitanes/${demoAdminIdentifier}`);
	          }}
	        >
	          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	            <div className="space-y-2">
	              <div className="flex flex-wrap items-center gap-2">
	                <h2 className="text-lg font-semibold">{demoEvent?.name || "Demo Capitanes by Revelao"}</h2>
	                <Badge variant="outline">Demo</Badge>
	                {demoEvent ? (
	                  <Badge variant={isCaptainsEventFinished(demoEvent) ? "outline" : "default"}>
	                    {isCaptainsEventFinished(demoEvent) ? "Terminado" : "En curso"}
	                  </Badge>
	                ) : null}
	              </div>
	              <p className="text-sm text-muted-foreground">
	                Edita las mesas, retos y configuración del evento público /capitanes/demo-capitanes.
	              </p>
	              {demoEvent ? (
	                <p className="text-xs text-muted-foreground">
	                  {demoEvent.table_count} mesas · {demoEvent.challenge_count} retos · Puntuación automática
	                </p>
	              ) : (
	                <p className="text-xs text-muted-foreground">El evento quedará disponible al sincronizar las migraciones de Supabase.</p>
	              )}
	            </div>
	            <Button type="button" onClick={(clickEvent) => { clickEvent.stopPropagation(); navigate(`/admin/capitanes/${demoAdminIdentifier}`); }}>
	              Editar demo
	            </Button>
	          </div>
	        </Card>
	      </TabsContent>
	    </Tabs>
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar código de Capitanes</DialogTitle>
            <DialogDescription>Da acceso al formulario público para crear un único evento.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2">
            <span className="text-sm font-medium">Número máximo de mesas</span>
            <Input type="number" min={1} max={999} value={codeTableCount} onChange={(event) => setCodeTableCount(Math.max(1, Math.min(999, Math.floor(Number(event.target.value) || 1))))} />
          </label>
          <Button onClick={generateCreationCode} disabled={isGeneratingCode}>
            {isGeneratingCode ? "Generando..." : "Generar código"}
          </Button>
          {generatedCode ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <p className="text-center font-mono text-xl font-bold tracking-widest">{generatedCode}</p>
              <Button variant="outline" className="w-full" onClick={async () => {
                const link = `${window.location.origin}/admin/capitanes/onboarding?code=${generatedCode}&tableCount=${codeTableCount}`;
                await navigator.clipboard.writeText(link);
                toast({ title: "Enlace copiado", description: "Ya puedes compartirlo con el cliente." });
              }}>
                <Copy className="mr-2 h-4 w-4" /> Copiar enlace público
              </Button>
              <Button
                className="w-full"
                onClick={() => navigate(`/admin/capitanes/onboarding?code=${encodeURIComponent(generatedCode)}&tableCount=${codeTableCount}`)}
              >
                <Plus className="mr-2 h-4 w-4" /> Empezar a crear
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminFrame>
  );
};

type CaptainsOnboardingStep = "intro" | "tables" | "challenges" | "contact";

const captainsOnboardingSteps: Array<{ id: CaptainsOnboardingStep; label: string }> = [
  { id: "intro", label: "Evento" },
  { id: "tables", label: "Mesas" },
  { id: "challenges", label: "Retos" },
  { id: "contact", label: "Contacto" },
];

export const CaptainsOnboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { data: catalog = [] } = useCaptainsChallengeCatalog();
  const defaultDateRange = useMemo(() => getDefaultCaptainsDateRange(), []);
  const availableCatalog = catalog.length ? catalog : captainsDefaultChallengeCatalog;
  const initialTableCount = useMemo(() => {
    const value = Number(searchParams.get("tableCount") || 6);
    return Math.max(1, Math.min(999, Math.floor(Number.isFinite(value) ? value : 6)));
  }, [searchParams]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [maxTables, setMaxTables] = useState<number | null>(null);
  const [accessCode, setAccessCode] = useState(() => (searchParams.get("code") || "").trim().toUpperCase());
  const [codeValidated, setCodeValidated] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const validateAccessCode = async () => {
    try {
      setIsValidatingCode(true);
      const { data, error } = await supabase.functions.invoke("redeem-captains-code", { body: { action: "validate", code: accessCode } });
      if (error || !data?.valid) throw error || new Error("INVALID_CODE");
      const validatedMaxTables = Math.max(1, Number(data.maxTables) || 1);
      setMaxTables(validatedMaxTables);
      if (data.mode === "edit" && data.event?.id) {
        const start = splitDateTimeInput(data.event.start_time);
        const end = splitDateTimeInput(data.event.end_time);
        setEditingEventId(data.event.id);
        setName(data.event.name || "");
        setDescription(data.event.description || "");
        setStartDate(start.date);
        setStartHour(start.time);
        setEndDate(end.date);
        setEndHour(end.time);
        setContactName(data.event.contact_name || "");
        setContactEmail(data.event.contact_email || "");
        setContactPhone(data.event.contact_phone || "");
        const loadedTables = (data.tables || []).map((table: CaptainsTable, index: number) => ({
          id: table.id,
          table_number: index + 1,
          table_name: table.table_name,
          captain_name: table.captain_name || "",
          captain_photo_url: table.captain_photo_url || "",
          captain_sprite: table.captain_sprite || getDefaultCaptainSprite(index),
          captain_sprite_config: normalizeCaptainSpriteConfig(table.captain_sprite_config, index),
        }));
        setTableCount(Math.max(1, loadedTables.length));
        setTables(loadedTables.length ? loadedTables : tables);
        const loadedChallenges = (data.challenges || []).map((challenge: CaptainsEventChallenge) => eventChallengeToInput(challenge));
        setSelectedChallenges(loadedChallenges);
        setSelectedChallengeIds(loadedChallenges.map((challenge: CaptainsChallengeInput) => challenge.catalog_challenge_id).filter(Boolean) as string[]);
      }
      if (data.mode !== "edit") syncTables(Math.min(tableCount, validatedMaxTables));
      setCodeValidated(true);
    } catch (error) {
      toast({ title: "Código no válido", description: "Revisa el código o solicita uno nuevo.", variant: "destructive" });
    } finally {
      setIsValidatingCode(false);
    }
  };
  const [name, setName] = useState("");
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [startHour, setStartHour] = useState(defaultDateRange.startTime);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [endHour, setEndHour] = useState(defaultDateRange.endTime);
  const primaryColor = DEFAULT_PRIMARY_COLOR;
  const [tableCount, setTableCount] = useState(initialTableCount);
  const [editingTableIndex, setEditingTableIndex] = useState<number | null>(null);
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [challengeLimitOpen, setChallengeLimitOpen] = useState(false);
  const [draftChallenge, setDraftChallenge] = useState<CaptainsChallengeInput>(() => ({ ...EMPTY_CHALLENGE }));
  const [tables, setTables] = useState(() =>
    Array.from({ length: initialTableCount }, (_, index) => ({
      table_number: index + 1,
      table_name: `Mesa ${index + 1}`,
      captain_name: "",
      captain_photo_url: "",
      captain_sprite: getDefaultCaptainSprite(index),
      captain_sprite_config: defaultCaptainSpriteConfig(index),
    })),
  );
  const [uploadingOnboardingCaptainPhotoIndex, setUploadingOnboardingCaptainPhotoIndex] = useState<number | null>(null);
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<CaptainsChallengeInput[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const currentStep = captainsOnboardingSteps[stepIndex];
  const progress = Math.round(((stepIndex + 1) / captainsOnboardingSteps.length) * 100);
  const primaryTextColor = readableTextColor(primaryColor);
  const catalogByCategory = useMemo(() => {
    return availableCatalog.reduce<Array<[string, CaptainsChallengeCatalogItem[]]>>((groups, item) => {
      const category = item.category || "General";
      const existing = groups.find(([group]) => group === category);
      if (existing) existing[1].push(item);
      else groups.push([category, [item]]);
      return groups;
    }, []);
  }, [availableCatalog]);
  const editingTable = editingTableIndex === null ? null : tables[editingTableIndex];

  const syncTables = (count: number) => {
    const cleanCount = Math.max(1, Math.min(maxTables ?? 999, Math.floor(count || 1)));
    setTableCount(cleanCount);
    setTables((prev) =>
      Array.from({ length: cleanCount }, (_, index) => {
        const existing = prev[index];
        return existing || {
          table_number: index + 1,
          table_name: `Mesa ${index + 1}`,
          captain_name: "",
          captain_photo_url: "",
          captain_sprite: getDefaultCaptainSprite(index),
          captain_sprite_config: defaultCaptainSpriteConfig(index),
        };
      }).map((table, index) => ({
        ...table,
        table_number: index + 1,
        table_name: table.table_name || `Mesa ${index + 1}`,
        captain_photo_url: table.captain_photo_url || "",
      })),
    );
  };

  const validateStep = (step: CaptainsOnboardingStep) => {
    if (step === "intro") {
      if (!name.trim()) return "Pon un nombre para el juego.";
      const start = editingEventId ? new Date(`${startDate}T${startHour}`) : new Date();
      const end = new Date(`${endDate}T${endHour}`);
      if (!startDate || !startHour || !endDate || !endHour || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Revisa las fechas del juego.";
      if (end <= start) return "La fecha de fin debe ser posterior al inicio.";
    }
    if (step === "tables" && tableCount < 1) return "Añade al menos una mesa.";
    if (step === "challenges" && selectedChallenges.length < 1) return "Selecciona al menos un reto.";
    if (step === "contact") {
      if (!contactName.trim() || !contactEmail.trim() || !contactPhone.trim()) return "Completa nombre, email y teléfono.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return "Introduce un email válido.";
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(currentStep.id);
    if (error) {
      toast({ title: "Revisa este paso", description: error, variant: "destructive" });
      return;
    }
    setStepIndex((index) => Math.min(index + 1, captainsOnboardingSteps.length - 1));
  };

  const goBack = () => setStepIndex((index) => Math.max(index - 1, 0));

  const updateOnboardingTable = (index: number, patch: Partial<(typeof tables)[number]>) => {
    setTables((prev) => prev.map((table, itemIndex) => (itemIndex === index ? { ...table, ...patch } : table)));
  };

  const updateOnboardingSpriteConfig = (index: number, patch: Partial<CaptainsSpriteConfig>) => {
    setTables((prev) =>
      prev.map((table, itemIndex) =>
        itemIndex === index
          ? {
              ...table,
              captain_sprite_config: {
                ...normalizeCaptainSpriteConfig(table.captain_sprite_config, index),
                ...patch,
              },
            }
          : table,
      ),
    );
  };

  const handleOnboardingCaptainPhotoSelected = async (index: number, file?: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    try {
      setUploadingOnboardingCaptainPhotoIndex(index);
      const blob = await createCircularCaptainPhotoBlob({ index, file, previewUrl, zoom: 1, offsetX: 0, offsetY: 0 });
      const cleanName = sanitizeCaptainPhotoName(file.name.replace(/\.[^.]+$/, ""));
      const filePath = `captains/captain-photos/new-onboarding/${Date.now()}-${index + 1}-${cleanName}.png`;
      const { error } = await supabase.storage.from("event-photos").upload(filePath, blob, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(filePath);
      updateOnboardingTable(index, { captain_photo_url: data.publicUrl });
      toast({ title: "Foto añadida", description: "La foto del capitán se ha aplicado a la mesa." });
    } catch (error) {
      console.error("Onboarding captain photo upload error:", error);
      toast({ title: "Error", description: "No hemos podido subir la foto del capitán.", variant: "destructive" });
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingOnboardingCaptainPhotoIndex(null);
    }
  };

  const toggleOnboardingCatalogChallenge = (challenge: CaptainsChallengeCatalogItem) => {
    const checked = selectedChallengeIds.includes(challenge.id);
    if (checked) {
      setSelectedChallengeIds((prev) => prev.filter((id) => id !== challenge.id));
      setSelectedChallenges((current) => current.filter((item) => item.catalog_challenge_id !== challenge.id));
      return;
    }
    if (selectedChallenges.length >= CAPTAINS_MAX_CHALLENGES) {
      setChallengeLimitOpen(true);
      return;
    }
    setSelectedChallengeIds((prev) => [...prev, challenge.id]);
    setSelectedChallenges((current) => [...current, catalogChallengeToInput(challenge, current.length + 1)]);
  };

  const updateOnboardingChallenge = (index: number, challenge: CaptainsChallengeInput) => {
    setSelectedChallenges((prev) => prev.map((item, itemIndex) => (itemIndex === index ? challenge : item)));
  };

  const deleteOnboardingChallenge = (index: number) => {
    const removed = selectedChallenges[index];
    if (removed?.catalog_challenge_id) {
      setSelectedChallengeIds((current) => current.filter((id) => id !== removed.catalog_challenge_id));
    }
    setSelectedChallenges((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const addBlankOnboardingChallenge = () => {
    if (selectedChallenges.length >= CAPTAINS_MAX_CHALLENGES) {
      setChallengeLimitOpen(true);
      return;
    }
    setDraftChallenge({
      ...EMPTY_CHALLENGE,
      title: `Nuevo reto ${selectedChallenges.length + 1}`,
      order_index: selectedChallenges.length + 1,
    });
    setIsCreatingChallenge(true);
  };

  const addDraftOnboardingChallenge = () => {
    if (!draftChallenge.title.trim()) {
      toast({ title: "Revisa el reto", description: "Pon un título para el reto nuevo.", variant: "destructive" });
      return;
    }
    if (selectedChallenges.length >= CAPTAINS_MAX_CHALLENGES) {
      setIsCreatingChallenge(false);
      setChallengeLimitOpen(true);
      return;
    }
    setSelectedChallenges((prev) => [
      ...prev,
      {
        ...draftChallenge,
        title: draftChallenge.title.trim(),
        description: draftChallenge.description.trim(),
        category: draftChallenge.category.trim() || "Personalizado",
        order_index: prev.length + 1,
      },
    ]);
    setIsCreatingChallenge(false);
  };

  const handleSave = async () => {
    const firstError = captainsOnboardingSteps.map((step) => validateStep(step.id)).find(Boolean);
    if (firstError) {
      toast({ title: "Revisa el juego", description: firstError, variant: "destructive" });
      return;
    }
    try {
      setIsSaving(true);
      const startIso = editingEventId ? dateTimePartsToIso(startDate, startHour) : new Date().toISOString();
      const endIso = dateTimePartsToIso(endDate, endHour);
      const gameInput = {
        event: {
          name: name.trim(),
          description: description.trim(),
          start_time: startIso,
          end_time: endIso,
          scoring_mode: "automatic" as const,
          show_live_gallery_after_completion: true,
          theme_style: "pixel" as const,
          primary_color: DEFAULT_PRIMARY_COLOR,
          secondary_color: DEFAULT_SECONDARY_COLOR,
	          background_image_url: null,
	          contact_name: contactName.trim(),
	          contact_email: contactEmail.trim(),
	          contact_phone: contactPhone.trim(),
	          status: "active" as const,
	        },
	        tables,
	        challenges: selectedChallenges,
	      };
      const { data, error } = await supabase.functions.invoke("redeem-captains-code", {
        body: { action: editingEventId ? "update" : "create", code: accessCode, ...gameInput },
      });
      if (error) {
        let responseBody: { error?: string; detail?: string } | null = null;
        const response = (error as { context?: Response })?.context;
        if (response && typeof response.clone === "function") {
          try {
            responseBody = await response.clone().json();
          } catch {
            // The function may return an empty/non-JSON response in infrastructure failures.
          }
        }
        const message = responseBody?.detail || responseBody?.error || error.message || "PUBLIC_CREATE_FAILED";
        throw Object.assign(new Error(message), { functionError: responseBody });
      }
      if (!data?.event) throw new Error(data?.detail || data?.error || "PUBLIC_CREATE_FAILED");
	      const created = data;
	      const createdEvent = created?.event;
	      if (createdEvent && !editingEventId) {
	        const publicUrl = normalizeCaptainsPublicUrl(createdEvent.public_url, createdEvent.slug);
	        const qrImageUrl = resolveCaptainsQrImageUrl(createdEvent.qr_url, publicUrl);
	        const adminUrl = `${window.location.origin}/admin/capitanes/${createdEvent.id}?code=${encodeURIComponent(accessCode)}`;
	        const contactInfo = {
	          name: contactName.trim(),
	          email: contactEmail.trim(),
	          phone: contactPhone.trim(),
	        };
	        await Promise.allSettled([
	          supabase.functions.invoke("send-captains-event-email", {
	            body: {
	              event: createdEvent,
	              contactInfo,
	              publicUrl,
	              qrImageUrl,
	              adminUrl,
	              tableCount: tables.length,
	              challengeCount: selectedChallenges.length,
	            },
	          }),
	          supabase.functions.invoke("notify-admin-new-event", {
	            body: {
	              event: createdEvent,
	              planLabel: "Capitanes",
	              panelPath: `/admin/capitanes/${createdEvent.id}`,
	            },
	          }),
	        ]);
	      }
	      toast({ title: editingEventId ? "Juego actualizado" : "Juego creado", description: "Capitanes ya está listo para usar." });
	      navigate(`/admin/capitanes/${created?.event.id}?code=${encodeURIComponent(accessCode)}`);
    } catch (error) {
      console.error("Error creating captains onboarding game:", error);
      const detail = error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "No hemos podido crear el juego",
        description: detail === "PUBLIC_CREATE_FAILED" ? "Comprueba que el código siga siendo válido." : detail,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep.id) {
      case "intro":
        return (
          <div className="space-y-5">
            <label className="space-y-2">
              <span className="text-sm font-medium">Nombre del juego</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Capitanes - Boda Ana y Marcos" className="h-12 rounded-full px-4 text-base" autoFocus />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Mensaje de bienvenida</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className="rounded-2xl px-4 py-3" />
            </label>
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Fecha de fin</span>
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Hora</span>
                  <Input type="time" value={endHour} onChange={(event) => setEndHour(event.target.value)} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                A partir de este momento, el ranking y todo el contenido generado se harán públicos para todos los grupos. Ya no se podrán completar más retos.
              </p>
            </div>
          </div>
        );
      case "tables":
        return (
          <div className="space-y-5">
            <label className="space-y-2">
              <span className="text-sm font-medium">Número de mesas</span>
              <Input type="number" min={1} max={maxTables ?? 999} value={tableCount} onChange={(event) => syncTables(Number(event.target.value))} className="h-12 w-32 rounded-full px-4 text-center text-base" />
              {maxTables ? <span className="block text-xs text-muted-foreground">Máximo incluido en tu código: {maxTables} mesas.</span> : null}
            </label>
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Haz click en el muñeco de cada mesa para editar todos los detalles del capitán: nombre, mesa, aspecto, pelo, piel y vestuario.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {tables.map((table, index) => (
                <div key={index} className="rounded-2xl border border-border bg-card p-4">
	                  <div className="mb-3 flex items-center gap-3">
	                    <button
	                      type="button"
	                      className="rounded-xl border border-transparent p-1 transition hover:border-primary hover:bg-primary/5"
	                      onClick={() => setEditingTableIndex(index)}
                      aria-label={`Editar detalles de la mesa ${index + 1}`}
                    >
                      <CaptainSpritePreview value={table.captain_sprite} config={table.captain_sprite_config} size="sm" />
                    </button>
                    <div>
                      <p className="text-sm font-semibold">Mesa {index + 1}</p>
	                      <p className="text-xs text-muted-foreground">Click en el muñeco para editar</p>
	                    </div>
	                  </div>
	                  <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
	                    <div className="flex min-w-0 items-center gap-3">
	                      <CaptainPhotoPreview table={table} size="sm" />
	                      <div className="min-w-0">
	                        <p className="text-xs font-medium text-foreground">Foto del capitán/a</p>
	                        <p className="truncate text-xs text-muted-foreground">
	                          {table.captain_photo_url ? "Foto añadida" : "Añádela desde aquí sin entrar al modal"}
	                        </p>
	                      </div>
	                    </div>
	                    <div className="flex shrink-0 items-center gap-2">
	                      {table.captain_photo_url ? (
	                        <Button
	                          type="button"
	                          variant="outline"
	                          size="icon"
	                          className="h-9 w-9 rounded-full"
	                          onClick={() => updateOnboardingTable(index, { captain_photo_url: "" })}
	                          aria-label={`Quitar foto de la mesa ${index + 1}`}
	                          title="Quitar foto"
	                        >
	                          <X className="h-4 w-4" />
	                        </Button>
	                      ) : null}
	                      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted">
	                        {uploadingOnboardingCaptainPhotoIndex === index ? (
	                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
	                        ) : (
	                          <Upload className="h-3.5 w-3.5" />
	                        )}
	                        <span className="hidden sm:inline">
	                          {uploadingOnboardingCaptainPhotoIndex === index ? "Subiendo..." : table.captain_photo_url ? "Cambiar" : "Subir"}
	                        </span>
	                        <input
	                          type="file"
	                          accept="image/*"
	                          className="hidden"
	                          disabled={uploadingOnboardingCaptainPhotoIndex === index}
	                          onChange={(event) => {
	                            handleOnboardingCaptainPhotoSelected(index, event.target.files?.[0]);
	                            event.currentTarget.value = "";
	                          }}
	                        />
	                      </label>
	                    </div>
	                  </div>
	                  <div className="grid gap-2">
	                    <Input value={table.table_name} onChange={(event) => setTables((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, table_name: event.target.value } : item))} placeholder={`Mesa ${index + 1}`} />
	                    <Input value={table.captain_name} onChange={(event) => setTables((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, captain_name: event.target.value } : item))} placeholder="Nombre capitán/a" />
	                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "challenges":
        return (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">{selectedChallenges.length}/{CAPTAINS_MAX_CHALLENGES} retos añadidos al evento</p>
                <p>Selecciona del catálogo completo, crea retos nuevos y edita el detalle antes de publicar.</p>
              </div>
              <Button type="button" className="gap-2" onClick={addBlankOnboardingChallenge} disabled={selectedChallenges.length >= CAPTAINS_MAX_CHALLENGES}>
                <Plus className="h-4 w-4" />
                Crear reto nuevo
              </Button>
            </div>
            <div className="max-h-[440px] space-y-5 overflow-y-auto rounded-2xl border border-border bg-card p-4">
              {catalogByCategory.map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{category}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((challenge) => {
                      const selected = selectedChallengeIds.includes(challenge.id);
                      return (
	                        <button
	                          key={challenge.id}
	                          type="button"
	                          onClick={() => toggleOnboardingCatalogChallenge(challenge)}
	                          className={`border p-4 text-left text-foreground transition hover:border-[#f06a5f] hover:bg-[#f06a5f]/5 ${selected ? "" : "rounded-2xl border-border bg-card"}`}
	                          style={
	                            selected
	                              ? {
	                                  borderColor: DEFAULT_PRIMARY_COLOR,
	                                  backgroundColor: "rgba(240, 106, 95, 0.12)",
	                                  borderRadius: "0.375rem",
	                                }
	                              : undefined
	                          }
	                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <p className="font-semibold text-foreground">{challenge.title}</p>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-semibold text-foreground">{challenge.default_points} pts</span>
                          </div>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{challenge.description}</p>
                          <p className="mt-2 text-xs font-medium text-muted-foreground">{evidenceLabels[challenge.evidence_type]} · {difficultyLabels[challenge.difficulty]}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">Retos del evento</h2>
                <p className="text-sm text-muted-foreground">Edita cualquier reto añadido desde el catálogo o creado manualmente.</p>
              </div>
              {selectedChallenges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Todavía no hay retos seleccionados para este evento.
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedChallenges.map((challenge, index) => (
                    <ChallengeEditor
                      key={`${challenge.catalog_challenge_id || "custom"}-${index}`}
                      challenge={challenge}
                      index={index}
                      onChange={(next) => updateOnboardingChallenge(index, next)}
                      onDelete={() => deleteOnboardingChallenge(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case "contact":
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Estos datos se guardarán en el detalle del evento. Al crear Capitanes enviaremos al usuario el resumen y el enlace de edición, y a Revelao el aviso interno del nuevo evento.
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">Nombre</span>
              <Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Nombre y apellidos" className="h-12 rounded-full px-4 text-base" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Email</span>
              <Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="tu@email.com" className="h-12 rounded-full px-4 text-base" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Teléfono</span>
              <Input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+34 600 000 000" className="h-12 rounded-full px-4 text-base" />
            </label>
          </div>
        );
    }
  };

  if (!codeValidated) {
    return (
      <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16">
        <Card className="mx-auto max-w-md rounded-3xl p-6 shadow-sm sm:p-8">
          <img src="/LogoTransparent.png" alt="Revelao" className="mb-8 h-8 w-auto" />
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Crea tu evento de Capitanes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Introduce el código que te ha facilitado Revelao para acceder al formulario.</p>
          <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); validateAccessCode(); }}>
            <Input
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
              placeholder="CÓDIGO DE 16 CARACTERES"
              className="h-12 text-center font-mono tracking-widest"
              autoFocus
            />
            <Button type="submit" className="h-12 w-full rounded-full" disabled={accessCode.length !== 16 || isValidatingCode}>
              {isValidatingCode ? "Validando..." : "Acceder al formulario"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <>
    <main className="admin-demo2-shell min-h-screen bg-background" data-scroll-container>
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-5 sm:px-6 lg:py-8">
        <section className="flex flex-1 flex-col">
          <div className="mb-5 space-y-3">
            <div className="flex justify-center sm:justify-start">
              <img src="/LogoTransparent.png" alt="Revelao" className="h-8 w-auto" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{editingEventId ? "Edita tu juego de Capitanes" : "Crea tu juego de Capitanes"}</h1>
              <p className="text-sm text-muted-foreground">Configura el juego por pasos y guarda todos los cambios sin necesidad de iniciar sesión.</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: primaryColor }} />
            </div>
            <ol className="-mx-4 flex gap-0 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {captainsOnboardingSteps.map((step, index) => (
                <li key={step.id} className="flex min-w-[128px] flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (index <= stepIndex) setStepIndex(index);
                  }}
                  className={`flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition ${
                    index === stepIndex
                      ? "border-primary bg-primary/10 text-foreground shadow-sm"
                      : index < stepIndex
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${index === stepIndex ? "bg-primary/15 text-foreground" : index < stepIndex ? "bg-emerald-100" : "bg-muted"}`}>
                    {index < stepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </button>
                {index < captainsOnboardingSteps.length - 1 ? <span className={`mx-1 hidden h-px w-5 shrink-0 sm:block ${index < stepIndex ? "bg-emerald-300" : "bg-border"}`} /> : null}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-1 flex-col pb-28">
            <div className="flex-1 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{currentStep.label}</p>
              </div>
              {renderStep()}
            </div>
            <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mx-auto flex max-w-4xl gap-3">
                <Button type="button" variant="outline" className="h-12 w-14 flex-none rounded-full sm:w-auto sm:flex-1" onClick={goBack} disabled={stepIndex === 0 || isSaving}>
                  <ArrowLeft className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Atrás</span>
                </Button>
                <Button type="button" className="h-12 flex-1 rounded-full hover:opacity-90" style={{ backgroundColor: primaryColor, color: primaryTextColor }} onClick={currentStep.id === "contact" ? handleSave : goNext} disabled={isSaving}>
                  {currentStep.id === "contact" ? (isSaving ? "Guardando..." : editingEventId ? "Guardar cambios" : "Crear Capitanes") : "Siguiente"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
    <Dialog open={editingTableIndex !== null} onOpenChange={(open) => { if (!open) setEditingTableIndex(null); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar detalles de la mesa</DialogTitle>
          <DialogDescription>Personaliza el capitán que verá cada mesa al entrar al juego.</DialogDescription>
        </DialogHeader>
        {editingTable && editingTableIndex !== null ? (
          <div className="space-y-5">
            <div className="flex justify-center">
              <CaptainSpritePreview value={editingTable.captain_sprite} config={editingTable.captain_sprite_config} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Nombre de la mesa</span>
                <Input value={editingTable.table_name} onChange={(event) => updateOnboardingTable(editingTableIndex, { table_name: event.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Nombre del capitán/a</span>
                <Input value={editingTable.captain_name} onChange={(event) => updateOnboardingTable(editingTableIndex, { captain_name: event.target.value })} placeholder="Opcional" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Sexo</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editingTable.captain_sprite_config.sex}
                  onChange={(event) => {
                    const sex = event.target.value as CaptainsSpriteConfig["sex"];
                    updateOnboardingSpriteConfig(editingTableIndex, { sex, outfit_type: sex === "female" ? "dress" : "suit" });
                  }}
                >
                  <option value="male">Hombre</option>
                  <option value="female">Mujer</option>
                  <option value="unspecified">Prefiero no decirlo</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Pelo</span>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingTable.captain_sprite_config.hair_length} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { hair_length: event.target.value as CaptainsSpriteConfig["hair_length"] })}>
                  <option value="short">Corto</option>
                  <option value="long">Largo</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Color pelo</span>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingTable.captain_sprite_config.hair_color} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { hair_color: event.target.value as CaptainsSpriteConfig["hair_color"] })}>
                  {hairColorOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Color piel</span>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingTable.captain_sprite_config.skin_color} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { skin_color: event.target.value as CaptainsSpriteConfig["skin_color"] })}>
                  {skinColorOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Vestuario</span>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editingTable.captain_sprite_config.outfit_type} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { outfit_type: event.target.value as CaptainsSpriteConfig["outfit_type"] })}>
                  <option value="dress">Vestido</option>
                  <option value="suit">Traje</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Color vestido</span>
                <Input type="color" value={colorValue(editingTable.captain_sprite_config.dress_color, "#202235")} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { dress_color: event.target.value })} className="h-10" disabled={editingTable.captain_sprite_config.outfit_type !== "dress"} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Color traje</span>
                <Input type="color" value={colorValue(editingTable.captain_sprite_config.suit_color, "#1f2937")} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { suit_color: event.target.value })} className="h-10" disabled={editingTable.captain_sprite_config.outfit_type !== "suit"} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Color corbata</span>
                <Input type="color" value={colorValue(editingTable.captain_sprite_config.tie_color, "#f06a5f")} onChange={(event) => updateOnboardingSpriteConfig(editingTableIndex, { tie_color: event.target.value })} className="h-10" disabled={editingTable.captain_sprite_config.outfit_type !== "suit"} />
              </label>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={() => setEditingTableIndex(null)}>Listo</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    <Dialog open={isCreatingChallenge} onOpenChange={setIsCreatingChallenge}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear reto nuevo</DialogTitle>
          <DialogDescription>Completa la información del reto. Al añadirlo aparecerá en el listado con el resto de retos del evento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <ChallengeEditor
            challenge={draftChallenge}
            index={selectedChallenges.length}
            onChange={setDraftChallenge}
            onDelete={() => setIsCreatingChallenge(false)}
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCreatingChallenge(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={addDraftOnboardingChallenge}>
              Añadir al listado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={challengeLimitOpen} onOpenChange={setChallengeLimitOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Límite de retos alcanzado</DialogTitle>
          <DialogDescription>El máximo por evento es de {CAPTAINS_MAX_CHALLENGES} retos. Elimina alguno del listado para añadir otro.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button type="button" onClick={() => setChallengeLimitOpen(false)}>Entendido</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
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
  <Card className="rounded-2xl p-4 shadow-sm">
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
  const [themeStyle, setThemeStyle] = useState<CaptainsThemeStyle>("pixel");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY_COLOR);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [selectedChallenges, setSelectedChallenges] = useState<CaptainsChallengeInput[]>([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [challengeLimitOpen, setChallengeLimitOpen] = useState(false);
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
    setThemeStyle(detail.event.theme_style || "pixel");
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
    if (selectedChallenges.length > CAPTAINS_MAX_CHALLENGES) return `El máximo por evento es de ${CAPTAINS_MAX_CHALLENGES} retos.`;
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
    if (selectedChallenges.length + items.length > CAPTAINS_MAX_CHALLENGES) {
      setChallengeLimitOpen(true);
      return;
    }
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
      if (selectedChallenges.length + imported.length > CAPTAINS_MAX_CHALLENGES) {
        setChallengeLimitOpen(true);
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
      const startIso = edit ? dateTimePartsToIso(startDate, startHour) : new Date().toISOString();
      const endIso = dateTimePartsToIso(endDate, endHour);
      const eventPayload = {
        name: name.trim(),
        description: description.trim(),
        start_time: startIso,
        end_time: endIso,
        scoring_mode: "automatic" as const,
        show_live_gallery_after_completion: true,
        theme_style: "pixel" as const,
        primary_color: DEFAULT_PRIMARY_COLOR,
        secondary_color: DEFAULT_SECONDARY_COLOR,
        background_image_url: null,
        status: "active" as const,
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
        <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-sm">Cargando juego...</Card>
      </AdminFrame>
    );
  }

  return (
    <>
    <AdminFrame title={edit ? "Editar juego de Capitanes" : "Nuevo juego de Capitanes"} subtitle={`Paso ${step} de 2`}>
      {step === 1 ? (
        <Card className="space-y-5 rounded-2xl p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Nombre del evento</span>
              <Input value={name} placeholder="Boda de Ana & Marcos" onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Descripción inicial</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} />
            </label>
            {!edit ? <div className="grid gap-4 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Estilo visual del juego mobile</span>
                <p className="text-xs text-muted-foreground">
                  Elige la personalidad visual de la experiencia pública: tipografías, bordes y tono de los controles.
                </p>
              </div>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium">Estilo</span>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={themeStyle}
                  onChange={(event) => setThemeStyle(event.target.value as CaptainsThemeStyle)}
                >
                  {captainsThemeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:col-span-2 md:grid-cols-4">
                {captainsThemeOptions.map((option) => {
                  const selected = themeStyle === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setThemeStyle(option.value)}
                      className={`min-h-[122px] rounded-xl border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${
                        selected ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <div className={`mb-2 p-3 text-lg font-black ${option.previewClass}`}>
                        <span className={option.headingClass}>{option.label}</span>
                      </div>
                      <p className="text-xs font-medium text-foreground">{option.description}</p>
                    </button>
                  );
                })}
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
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm md:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Vista previa</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {getCaptainsThemeOption(themeStyle).label}: {getCaptainsThemeOption(themeStyle).description}
                    </p>
                  </div>
                  <CaptainSpritePreview
                    value={captains[0]?.captain_sprite || "suit"}
                    config={captains[0]?.captain_sprite_config || defaultCaptainSpriteConfig(0)}
                  />
                </div>
                <div
                  className={`mt-4 inline-flex border px-4 py-2 text-sm font-bold text-white ${getCaptainsThemeOption(themeStyle).previewClass}`}
                  style={{ backgroundColor: primaryColor }}
                >
                  Hacer foto
                </div>
              </div>
            </div> : null}
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
                  <span className="text-sm font-medium">Fecha de fin</span>
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium">Hora</span>
                  <Input type="time" value={endHour} onChange={(event) => setEndHour(event.target.value)} />
                </label>
              </div>
              <p className="text-xs text-muted-foreground md:col-span-2">A partir de esta fecha y hora ya no se podrán completar retos; el ranking y el contenido generado se harán públicos para todos los grupos.</p>
            </div>
            {!edit ? <label className="space-y-1">
              <span className="text-sm font-medium">Modo de puntuación</span>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={scoringMode}
                onChange={(event) => setScoringMode(event.target.value as "automatic" | "manual")}
              >
                <option value="automatic">Puntuación automática</option>
                <option value="manual">Revisión manual</option>
              </select>
            </label> : null}
            {!edit ? <label className="space-y-1 md:col-span-2">
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
            </label> : null}
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
                  <div key={index} className="space-y-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
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
                    <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
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
            <Card className="flex min-h-0 flex-col space-y-4 overflow-hidden rounded-2xl p-4 shadow-sm">
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
	            <p className="text-xs text-muted-foreground">{selectedChallenges.length}/{CAPTAINS_MAX_CHALLENGES} retos añadidos al evento</p>
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
	            <Button
	              variant="outline"
	              className="w-full gap-2"
	              onClick={() => {
	                if (selectedChallenges.length >= CAPTAINS_MAX_CHALLENGES) {
	                  setChallengeLimitOpen(true);
	                  return;
	                }
	                setSelectedChallenges((prev) => [...prev, { ...EMPTY_CHALLENGE, order_index: prev.length + 1 }]);
	              }}
	            >
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
	    <Dialog open={challengeLimitOpen} onOpenChange={setChallengeLimitOpen}>
	      <DialogContent className="max-w-sm">
	        <DialogHeader>
	          <DialogTitle>Límite de retos alcanzado</DialogTitle>
	          <DialogDescription>El máximo por evento es de {CAPTAINS_MAX_CHALLENGES} retos. Elimina alguno del listado para añadir otro.</DialogDescription>
	        </DialogHeader>
	        <div className="flex justify-end">
	          <Button type="button" onClick={() => setChallengeLimitOpen(false)}>Entendido</Button>
	        </div>
	      </DialogContent>
	    </Dialog>
    </>
  );
};

const EvidencePreview = ({ evidence }: { evidence: CaptainsEvidence }) => {
  const [url, setUrl] = useState("");
  const [videoPoster, setVideoPoster] = useState("");

  useEffect(() => {
    let active = true;
    getCaptainsEvidenceSignedUrl(evidence.file_url, evidence.evidence_type === "photo")
      .then((signedUrl) => {
        if (active) setUrl(signedUrl);
      })
      .catch(() => setUrl(""));
    return () => {
      active = false;
    };
  }, [evidence.file_url]);

  useEffect(() => {
    if (!url || evidence.evidence_type !== "video") return;
    let active = true;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const capture = () => {
      if (!active || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        setVideoPoster(canvas.toDataURL("image/jpeg", 0.7));
      } catch { setVideoPoster(""); }
    };
    video.addEventListener("loadeddata", capture, { once: true });
    video.addEventListener("loadedmetadata", () => { try { video.currentTime = 0.1; } catch { /* no-op */ } }, { once: true });
    video.addEventListener("seeked", capture, { once: true });
    video.src = url;
    return () => { active = false; video.removeAttribute("src"); video.load(); };
  }, [evidence.evidence_type, url]);

  if (!url) {
    return <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">Preview</div>;
  }

  if (evidence.evidence_type === "photo") {
    return <img src={url} alt="" className="aspect-video w-full rounded-md object-cover" />;
  }
  if (evidence.evidence_type === "video") {
    return <video src={url} poster={videoPoster || undefined} controls playsInline preload="metadata" className="aspect-video w-full rounded-md bg-black object-contain" />;
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
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" className="gap-1" disabled={busy} onClick={() => run("approve")}>
              <Check className="h-4 w-4" />
              Aprobar
            </Button>
            <Button size="sm" variant="outline" className="gap-1" disabled={busy} onClick={() => run("reject")}>
              <X className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};

export const CaptainsAdminDetail = ({ view = "detail" }: { view?: "detail" | "review" | "ranking" }) => {
  const { eventId } = useParams();
  const [detailSearchParams] = useSearchParams();
  const detailAccessCode = (detailSearchParams.get("code") || "").trim().toUpperCase();
  useRequireAdmin(Boolean(detailAccessCode));
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [codeAccessState, setCodeAccessState] = useState<"checking" | "valid" | "invalid">(detailAccessCode ? "checking" : "valid");
  useEffect(() => {
    if (!detailAccessCode) {
      setCodeAccessState("valid");
      return;
    }
    let active = true;
    supabase.functions.invoke("redeem-captains-code", { body: { action: "validate", code: detailAccessCode } }).then(({ data, error }) => {
      if (!active) return;
      const recognizedMode = data?.mode === "edit" || data?.mode === "existing";
      setCodeAccessState(!error && recognizedMode && data?.event?.id === eventId ? "valid" : "invalid");
    });
    return () => { active = false; };
  }, [detailAccessCode, eventId]);
  const { data: detail, isLoading, isError, refetch } = useCaptainsEventDetail(eventId);
  const { data: challengeCatalog = [] } = useCaptainsChallengeCatalog();
  const { data: ranking = [] } = useCaptainsRanking(eventId);
  const { data: tableChallenges = [] } = useQuery({
    queryKey: ["captains", "table-challenges", eventId],
    queryFn: () => getCaptainsTableChallenges(eventId || ""),
    enabled: Boolean(eventId),
    refetchInterval: 5000,
  });
  const [selectedEvidence, setSelectedEvidence] = useState<CaptainsEvidence | null>(null);
  const [generalDraft, setGeneralDraft] = useState({
    name: "",
    description: "",
    endDate: "",
    endHour: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });
  const generalDraftRef = useRef(generalDraft);
  const generalSavedFingerprintRef = useRef("");
  const [generalSaveStatus, setGeneralSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editingTable, setEditingTable] = useState<CaptainsTable | null>(null);
  const [tableSaveStatus, setTableSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const tableSavedFingerprintRef = useRef("");
  const [resettingTableActivityId, setResettingTableActivityId] = useState("");
  const [isResettingAllTables, setIsResettingAllTables] = useState(false);
  const [tableDraft, setTableDraft] = useState<CaptainsTable | null>(null);
  const [detailCaptainPhotoCrop, setDetailCaptainPhotoCrop] = useState<CaptainPhotoCropState | null>(null);
  const [isUploadingDetailCaptainPhoto, setIsUploadingDetailCaptainPhoto] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<CaptainsEventChallenge | null>(null);
  const [challengeDraft, setChallengeDraft] = useState<CaptainsChallengeInput | null>(null);
  const [addChallengeOpen, setAddChallengeOpen] = useState(false);
  const [addChallengeMode, setAddChallengeMode] = useState<"catalog" | "manual">("catalog");
  const [newChallengeDraft, setNewChallengeDraft] = useState<CaptainsChallengeInput>({ ...EMPTY_CHALLENGE });
  const [editingEvidence, setEditingEvidence] = useState<CaptainsEvidence | null>(null);
	  const [evidenceDraft, setEvidenceDraft] = useState({ status: "uploaded" as CaptainsEvidence["status"], points: 0, comment: "" });
	  const [contentView, setContentView] = useState<"retos" | "capitanes">("retos");
	  const [openContentGroup, setOpenContentGroup] = useState("");
	  const [isDetailSaving, setIsDetailSaving] = useState(false);
	  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [deleteEventOpen, setDeleteEventOpen] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<CaptainsDetailTab>(
    view === "ranking" ? "tables" : view === "review" ? "content" : "general",
  );
  const { data: evidenceIndex = [] } = useQuery({
    queryKey: ["captains", "evidence-index", eventId],
    queryFn: () => getCaptainsEvidenceIndex(eventId || ""),
    enabled: Boolean(eventId && activeDetailTab === "content"),
    refetchInterval: activeDetailTab === "content" ? 5000 : false,
  });

  useEffect(() => {
    setActiveDetailTab(view === "ranking" ? "tables" : view === "review" ? "content" : "general");
  }, [view]);

  useEffect(() => {
    setOpenContentGroup("");
  }, [contentView, eventId]);

  useEffect(() => {
    if (!detail) return;
    const end = splitDateTimeInput(detail.event.end_time);
    const nextDraft = {
      name: detail.event.name,
      description: detail.event.description || "",
      endDate: end.date,
      endHour: end.time,
      contactName: detail.event.contact_name || "",
      contactEmail: detail.event.contact_email || "",
      contactPhone: detail.event.contact_phone || "",
    };
    generalDraftRef.current = nextDraft;
    generalSavedFingerprintRef.current = JSON.stringify(nextDraft);
    setGeneralDraft(nextDraft);
  }, [detail]);

  useEffect(() => {
    generalDraftRef.current = generalDraft;
  }, [generalDraft]);

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

  const contentGroups = useMemo(() => {
    const answeredRows = tableChallenges.filter((row) => {
      const challenge = challengesById.get(row.challenge_id);
      return challenge?.evidence_type === "question" && Boolean(row.question_answer?.trim());
    });

    if (contentView === "retos") {
      const countByTableChallenge = new Map<string, number>();
      evidenceIndex.forEach((item) => {
        countByTableChallenge.set(item.table_challenge_id, (countByTableChallenge.get(item.table_challenge_id) || 0) + 1);
      });
      return (detail?.challenges || [])
        .map((challenge) => {
          const tableChallengeIds = tableChallenges
            .filter((row) => row.challenge_id === challenge.id)
            .map((row) => row.id);
          const answerCount = answeredRows.filter((row) => row.challenge_id === challenge.id).length;
          const count = tableChallengeIds.reduce((total, id) => total + (countByTableChallenge.get(id) || 0), 0) + answerCount;
          return { id: `challenge:${challenge.id}`, label: challenge.title, count, tableChallengeIds, tableId: undefined as string | undefined };
        })
        .filter((group) => group.count > 0);
    }

    const countByTable = new Map<string, number>();
    evidenceIndex.forEach((item) => {
      countByTable.set(item.table_id, (countByTable.get(item.table_id) || 0) + 1);
    });
    return (detail?.tables || [])
      .map((table) => {
        const captainName = table.active_captain_name || table.captain_name;
        return {
          id: `table:${table.id}`,
          label: captainName ? `${table.table_name} - ${captainName}` : table.table_name,
          count: (countByTable.get(table.id) || 0) + answeredRows.filter((row) => row.table_id === table.id).length,
          tableId: table.id,
          tableChallengeIds: undefined as string[] | undefined,
        };
      })
      .filter((group) => group.count > 0);
  }, [contentView, detail?.challenges, detail?.tables, evidenceIndex, tableChallenges]);

  const activeContentGroup = contentGroups.find((group) => group.id === openContentGroup);
  const activeQuestionAnswers = useMemo(() => {
    if (!activeContentGroup) return [];
    return tableChallenges.filter((row) => {
      const challenge = challengesById.get(row.challenge_id);
      if (challenge?.evidence_type !== "question" || !row.question_answer?.trim()) return false;
      if (activeContentGroup.tableId) return row.table_id === activeContentGroup.tableId;
      return activeContentGroup.tableChallengeIds?.includes(row.id) ?? false;
    });
  }, [activeContentGroup, challengesById, tableChallenges]);
  const { data: openGroupEvidence = [], isLoading: isOpenGroupLoading } = useQuery({
    queryKey: ["captains", "evidence-group", eventId, contentView, openContentGroup],
    queryFn: () =>
      getCaptainsEvidenceGroup(eventId || "", {
        tableId: activeContentGroup?.tableId,
        tableChallengeIds: activeContentGroup?.tableChallengeIds,
      }),
    enabled: Boolean(eventId && activeDetailTab === "content" && activeContentGroup),
    refetchInterval: activeContentGroup ? 5000 : false,
  });

	  const refreshAll = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: captainsQueryKeys.ranking(eventId) });
    queryClient.invalidateQueries({ queryKey: captainsQueryKeys.evidence(eventId) });
    queryClient.invalidateQueries({ queryKey: ["captains", "evidence-index", eventId] });
    queryClient.invalidateQueries({ queryKey: ["captains", "evidence-group", eventId] });
    queryClient.invalidateQueries({ queryKey: ["captains", "table-challenges", eventId] });
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Enlace copiado", description: "La URL pública está en el portapapeles." });
  };

	  const handleDownloadQr = async () => {
	    try {
	      const response = await fetch(qrImageUrl);
	      if (!response.ok) throw new Error("QR_DOWNLOAD_FAILED");
	      const qrBlob = await response.blob();
	      const downloadUrl = URL.createObjectURL(qrBlob);
	      const a = document.createElement("a");
	      a.href = downloadUrl;
	      a.download = `${detail?.event.slug || "capitanes"}-qr.png`;
	      document.body.appendChild(a);
	      a.click();
	      URL.revokeObjectURL(downloadUrl);
	      document.body.removeChild(a);
	    } catch (error) {
	      console.error("Captains QR download error:", error);
	      toast({ title: "Error", description: "No hemos podido descargar el QR.", variant: "destructive" });
	    }
	  };

  useEffect(() => {
    if (!detail || !eventId) return;
    const draft = { ...generalDraftRef.current };
    const fingerprint = JSON.stringify(draft);
    if (!generalSavedFingerprintRef.current || fingerprint === generalSavedFingerprintRef.current) return;

    const timer = window.setTimeout(async () => {
      const endTime = dateTimePartsToIso(draft.endDate, draft.endHour);
      if (!draft.name.trim() || !endTime || new Date(endTime).getTime() <= new Date(detail.event.start_time || detail.event.created_at).getTime()) {
        setGeneralSaveStatus("error");
        return;
      }
      try {
        setGeneralSaveStatus("saving");
        const updatedEvent = await updateCaptainsEvent(detail.event.id, {
          name: draft.name.trim(),
          description: draft.description.trim(),
          end_time: endTime,
          scoring_mode: "automatic",
          theme_style: "pixel",
          primary_color: DEFAULT_PRIMARY_COLOR,
          secondary_color: DEFAULT_SECONDARY_COLOR,
          background_image_url: null,
          contact_name: draft.contactName.trim() || null,
          contact_email: draft.contactEmail.trim().toLowerCase() || null,
          contact_phone: draft.contactPhone.trim() || null,
          status: "active",
          show_live_gallery_after_completion: true,
        });
        generalSavedFingerprintRef.current = fingerprint;
        if (JSON.stringify(generalDraftRef.current) === fingerprint) {
          queryClient.setQueryData<CaptainsEventDetail | null>(captainsQueryKeys.event(eventId), (current) =>
            current ? { ...current, event: updatedEvent } : current,
          );
          queryClient.invalidateQueries({ queryKey: captainsQueryKeys.events() });
          setGeneralSaveStatus("saved");
        }
      } catch (error) {
        console.error("Error autosaving captains event:", error);
        setGeneralSaveStatus("error");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [detail, eventId, generalDraft, queryClient]);

  const openTableEditor = (table: CaptainsTable) => {
    const normalized = {
      ...table,
      captain_name: table.captain_name || "",
      active_captain_name: table.active_captain_name || table.captain_name || "",
      captain_photo_url: table.captain_photo_url || "",
      captain_sprite: table.captain_sprite || getDefaultCaptainSprite(table.table_number - 1),
      captain_sprite_config: normalizeCaptainSpriteConfig(table.captain_sprite_config, table.table_number - 1),
    } as CaptainsTable;
    tableSavedFingerprintRef.current = JSON.stringify({
      table_name: normalized.table_name,
      captain_name: normalized.captain_name,
      active_captain_name: normalized.captain_name,
      captain_photo_url: normalized.captain_photo_url,
      captain_sprite: normalized.captain_sprite,
      captain_sprite_config: normalized.captain_sprite_config,
    });
    setTableSaveStatus("idle");
    setEditingTable(table);
    setTableDraft(normalized);
  };

  const resetTableLastActivity = async (table: CaptainsTable) => {
    const confirmed = window.confirm(`¿Resetear ${table.table_name}? Se borrará también todo el contenido que haya subido, tanto de la base de datos como de Storage.`);
    if (!confirmed) return;
    try {
      setResettingTableActivityId(table.id);
      await resetCaptainsTableLastActivity(table.id);
      toast({ title: "Partida reiniciada", description: `${table.table_name} volverá a comenzar desde el primer reto y su contenido se ha eliminado.` });
      refreshAll();
    } catch (error) {
      console.error("Error resetting captains table activity:", error);
      toast({ title: "Error", description: "No hemos podido reiniciar la partida de la mesa.", variant: "destructive" });
    } finally {
      setResettingTableActivityId("");
    }
  };

  const resetAllTables = async () => {
    if (!eventId) return;
    const confirmed = window.confirm("¿Resetear todas las mesas? Se eliminarán todas las puntuaciones y todo el contenido subido, también de Storage. Esta acción no se puede deshacer.");
    if (!confirmed) return;
    try {
      setIsResettingAllTables(true);
      await resetAllCaptainsTables(eventId);
      toast({ title: "Todas las partidas reiniciadas", description: "Se han eliminado las puntuaciones y todo el contenido subido." });
      refreshAll();
    } catch (error) {
      console.error("Error resetting all captains tables:", error);
      toast({ title: "Error", description: "No hemos podido resetear todas las mesas.", variant: "destructive" });
    } finally {
      setIsResettingAllTables(false);
    }
  };

  useEffect(() => {
    if (!editingTable || !tableDraft || !eventId) return;
    const payload = {
      table_name: tableDraft.table_name,
      captain_name: tableDraft.captain_name,
      active_captain_name: tableDraft.captain_name,
      captain_photo_url: tableDraft.captain_photo_url,
      captain_sprite: tableDraft.captain_sprite,
      captain_sprite_config: tableDraft.captain_sprite_config,
    };
    const fingerprint = JSON.stringify(payload);
    if (fingerprint === tableSavedFingerprintRef.current) return;

    const timer = window.setTimeout(async () => {
      try {
        setTableSaveStatus("saving");
        const updatedTable = await updateCaptainsTable(editingTable.id, payload);
        tableSavedFingerprintRef.current = fingerprint;
        queryClient.setQueryData<CaptainsEventDetail | null>(captainsQueryKeys.event(eventId), (current) =>
          current
            ? { ...current, tables: current.tables.map((table) => (table.id === updatedTable.id ? updatedTable : table)) }
            : current,
        );
        queryClient.invalidateQueries({ queryKey: captainsQueryKeys.ranking(eventId) });
        setTableSaveStatus("saved");
      } catch (error) {
        console.error("Error autosaving captains table:", error);
        setTableSaveStatus("error");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [editingTable, eventId, queryClient, tableDraft]);

  const closeTableEditor = async () => {
    closeDetailCaptainPhotoCrop();
    if (editingTable && tableDraft) {
      const payload = {
        table_name: tableDraft.table_name,
        captain_name: tableDraft.captain_name,
        active_captain_name: tableDraft.captain_name,
        captain_photo_url: tableDraft.captain_photo_url,
        captain_sprite: tableDraft.captain_sprite,
        captain_sprite_config: tableDraft.captain_sprite_config,
      };
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== tableSavedFingerprintRef.current) {
        try {
          setTableSaveStatus("saving");
          await updateCaptainsTable(editingTable.id, payload);
          tableSavedFingerprintRef.current = fingerprint;
          refreshAll();
        } catch (error) {
          console.error("Error saving captains table on close:", error);
          setTableSaveStatus("error");
          toast({ title: "Error", description: "No hemos podido guardar los cambios del capitán.", variant: "destructive" });
          return;
        }
      }
    }
    setEditingTable(null);
    setTableDraft(null);
    setTableSaveStatus("idle");
  };

  const updateTableDraftSpriteConfig = (patch: Partial<CaptainsSpriteConfig>) => {
    setTableDraft((prev) =>
      prev
        ? {
            ...prev,
            captain_sprite_config: {
              ...normalizeCaptainSpriteConfig(prev.captain_sprite_config, prev.table_number - 1),
              ...patch,
            },
          }
        : prev,
    );
  };

  const handleDetailCaptainPhotoSelected = (file?: File | null) => {
    if (!file || !tableDraft) return;
    const previewUrl = URL.createObjectURL(file);
    setDetailCaptainPhotoCrop({
      index: tableDraft.table_number - 1,
      file,
      previewUrl,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  };

  const closeDetailCaptainPhotoCrop = () => {
    if (detailCaptainPhotoCrop?.previewUrl) URL.revokeObjectURL(detailCaptainPhotoCrop.previewUrl);
    setDetailCaptainPhotoCrop(null);
  };

  const handleDetailCaptainPhotoUpload = async () => {
    if (!detailCaptainPhotoCrop || !tableDraft || !eventId) return;
    try {
      setIsUploadingDetailCaptainPhoto(true);
      const blob = await createCircularCaptainPhotoBlob(detailCaptainPhotoCrop);
      const cleanName = sanitizeCaptainPhotoName(detailCaptainPhotoCrop.file.name.replace(/\.[^.]+$/, ""));
      const filePath = `captains/captain-photos/${eventId}/${Date.now()}-${tableDraft.table_number}-${cleanName}.png`;
      const { error } = await supabase.storage.from("event-photos").upload(filePath, blob, {
        cacheControl: "3600",
        contentType: "image/png",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("event-photos").getPublicUrl(filePath);
      setTableDraft((prev) => (prev ? { ...prev, captain_photo_url: data.publicUrl } : prev));
      closeDetailCaptainPhotoCrop();
      toast({ title: "Foto subida", description: "La imagen del capitán se ha añadido al detalle." });
    } catch (error) {
      console.error("Detail captain photo upload error:", error);
      toast({ title: "Error", description: "No hemos podido subir la imagen del capitán.", variant: "destructive" });
    } finally {
      setIsUploadingDetailCaptainPhoto(false);
    }
  };

  const openChallengeEditor = (challenge: CaptainsEventChallenge) => {
    setEditingChallenge(challenge);
    setChallengeDraft(eventChallengeToInput(challenge));
  };

  const saveChallengeEditor = async () => {
    if (!editingChallenge || !challengeDraft) return;
    try {
      setIsDetailSaving(true);
      await updateCaptainsEventChallenge(editingChallenge.id, challengeDraft);
      toast({ title: "Reto actualizado", description: "Se ha editado solo la implementación de este evento." });
      setEditingChallenge(null);
      setChallengeDraft(null);
      refreshAll();
    } catch (error) {
      console.error("Error updating captains challenge:", error);
      toast({ title: "Error", description: "No hemos podido actualizar el reto.", variant: "destructive" });
    } finally {
      setIsDetailSaving(false);
    }
  };

  const openAddChallenge = () => {
    if ((detail?.challenges.length || 0) >= CAPTAINS_MAX_CHALLENGES) {
      toast({ title: "Límite alcanzado", description: `El máximo general es de ${CAPTAINS_MAX_CHALLENGES} retos.`, variant: "destructive" });
      return;
    }
    setAddChallengeMode("catalog");
    setNewChallengeDraft({ ...EMPTY_CHALLENGE, order_index: (detail?.challenges.length || 0) + 1 });
    setAddChallengeOpen(true);
  };

  const addCatalogChallenge = async (catalogId: string) => {
    if (!eventId) return;
    try {
      setIsDetailSaving(true);
      await addCatalogChallengesToCaptainsEvent(eventId, [catalogId]);
      toast({ title: "Reto añadido", description: "El reto del catálogo ya está disponible para todas las mesas." });
      setAddChallengeOpen(false);
      refreshAll();
    } catch (error) {
      toast({ title: "No se ha podido añadir", description: error instanceof Error ? error.message : "Revisa el reto.", variant: "destructive" });
    } finally {
      setIsDetailSaving(false);
    }
  };

  const isCatalogChallengeAdded = (catalogItem: CaptainsChallengeCatalogItem) =>
    Boolean(detail?.challenges.some((challenge) =>
      challenge.catalog_challenge_id === catalogItem.id
      || challenge.title.trim().toLocaleLowerCase("es") === catalogItem.title.trim().toLocaleLowerCase("es"),
    ));

  const addManualChallenge = async () => {
    if (!eventId || !newChallengeDraft.title.trim() || !newChallengeDraft.description.trim()) {
      toast({ title: "Revisa el reto", description: "El título y la descripción son obligatorios.", variant: "destructive" });
      return;
    }
    try {
      setIsDetailSaving(true);
      await createCustomCaptainsChallenge(eventId, newChallengeDraft);
      toast({ title: "Reto añadido", description: "El nuevo reto ya está disponible para todas las mesas." });
      setAddChallengeOpen(false);
      refreshAll();
    } catch (error) {
      toast({ title: "No se ha podido añadir", description: error instanceof Error ? error.message : "Revisa el reto.", variant: "destructive" });
    } finally {
      setIsDetailSaving(false);
    }
  };

  const openEvidenceEditor = (item: CaptainsEvidence) => {
    setEditingEvidence(item);
    setEvidenceDraft({
      status: item.status,
      points: item.points_awarded || 0,
      comment: item.admin_comment || "",
    });
  };

  const deleteEvidenceFromCard = async (item: CaptainsEvidence) => {
    const confirmed = window.confirm("¿Seguro que quieres eliminar esta evidencia definitivamente? Se borrará también de Storage y se actualizará el ranking.");
    if (!confirmed) return;
    try {
      await deleteCaptainsEvidence(item.id);
      queryClient.setQueryData(["captains", "evidence-index", eventId], (current: Array<{ id: string }> | undefined) =>
        current?.filter((evidence) => evidence.id !== item.id),
      );
      queryClient.setQueriesData(
        { queryKey: ["captains", "evidence-group", eventId] },
        (current: Array<{ id: string }> | undefined) => current?.filter((evidence) => evidence.id !== item.id),
      );
      if (selectedEvidence?.id === item.id) setSelectedEvidence(null);
      if (editingEvidence?.id === item.id) setEditingEvidence(null);
      toast({ title: "Evidencia eliminada", description: "Se ha borrado del contenido, de Storage y del ranking." });
      refreshAll();
    } catch (error) {
      console.error("Error deleting captains evidence:", error);
      toast({ title: "Error", description: "No hemos podido eliminar la evidencia.", variant: "destructive" });
    }
  };

  const saveEvidenceEditor = async () => {
    if (!editingEvidence) return;
    try {
      setIsDetailSaving(true);
      await updateCaptainsEvidence(editingEvidence.id, {
        status: evidenceDraft.status,
        points_awarded: evidenceDraft.points,
        admin_comment: evidenceDraft.comment || null,
      });
      toast({ title: "Contenido actualizado", description: "Los cambios se han guardado y el ranking se ha recalculado." });
      setEditingEvidence(null);
      refreshAll();
    } catch (error) {
      console.error("Error updating captains evidence:", error);
      toast({ title: "Error", description: "No hemos podido actualizar el contenido.", variant: "destructive" });
    } finally {
      setIsDetailSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!detail) return;
    try {
      await deleteCaptainsEvent(detail.event.id);
      toast({ title: "Evento eliminado", description: "El juego de Capitanes se ha eliminado." });
      navigate("/admin/capitanes");
    } catch (error) {
      console.error("Error deleting captains event:", error);
      toast({ title: "Error", description: "No hemos podido eliminar el evento.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <AdminFrame title="Capitanes">
        <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground shadow-sm">Cargando juego...</Card>
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
	  const eventIsFinished = isCaptainsEventFinished(event);
	  const eventStatusLabel = eventIsFinished ? "Terminado" : "En curso";
	  const publicUrl = normalizeCaptainsPublicUrl(event.public_url, event.slug);
	  const qrImageUrl = resolveCaptainsQrImageUrl(event.qr_url, publicUrl);
	  const liveVisibleEvidence = evidenceIndex.filter((item) => item.file_url && !["deleted", "rejected"].includes(item.status));
	  const photoCount = liveVisibleEvidence.filter((item) => item.evidence_type === "photo").length;
	  const videoCount = liveVisibleEvidence.filter((item) => item.evidence_type === "video").length;
	  const questionCount = challenges.filter((item) => item.evidence_type === "question").length;
	  const answeredQuestionCount = tableChallenges.filter((row) => {
      const challenge = challengesById.get(row.challenge_id);
      return challenge?.evidence_type === "question" && Boolean(row.question_answer?.trim());
    }).length;
  const lastLiveEvidence = liveVisibleEvidence[0];

  const handleDownloadAllContent = async () => {
    if (!evidenceIndex.length && answeredQuestionCount === 0) return;
    try {
      setIsDownloadingAll(true);
      const allEvidence = await getCaptainsEvidence(event.id);
      const zip = new JSZip();
      const sanitize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "contenido";
      await Promise.all(allEvidence.filter((item) => item.file_url && item.evidence_type !== "question").map(async (item, index) => {
        const table = tables.find((candidate) => candidate.id === item.table_id);
        const tableChallenge = tableChallenges.find((candidate) => candidate.id === item.table_challenge_id);
        const challenge = tableChallenge ? challengesById.get(tableChallenge.challenge_id) : undefined;
        const signedUrl = await getCaptainsEvidenceSignedUrl(item.file_url);
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error("DOWNLOAD_FAILED");
        const blob = await response.blob();
        const rawExtension = item.file_url.split("?")[0].split(".").pop()?.toLowerCase();
        const extension = rawExtension && /^[a-z0-9]{2,5}$/.test(rawExtension) ? rawExtension : item.evidence_type === "video" ? "mp4" : "jpg";
        const time = new Date(item.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/:/g, "-");
        const folder = zip.folder(sanitize(challenge?.title || "Reto"));
        folder?.file(`${sanitize(table?.table_name || "Mesa")}_${time}_${index + 1}.${extension}`, blob);
      }));
      const questionAnswers = tableChallenges.filter((row) => {
        const challenge = challengesById.get(row.challenge_id);
        return challenge?.evidence_type === "question" && Boolean(row.question_answer?.trim());
      });
      if (questionAnswers.length > 0) {
        const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const rows = questionAnswers.map((row) => {
          const table = tables.find((candidate) => candidate.id === row.table_id);
          const challenge = challengesById.get(row.challenge_id);
          return [
            table?.table_name || "Mesa",
            table?.active_captain_name || table?.captain_name || "",
            challenge?.title || "Pregunta",
            row.question_answer || "",
            challenge?.question_correct_option || "",
            row.status === "completed" ? "Correcta" : "Incorrecta",
            row.points_awarded,
            row.submitted_at ? formatDateTime(row.submitted_at) : "",
          ].map(csvCell).join(";");
        });
        zip.file("respuestas-preguntas.csv", [
          ["Mesa", "Capitán", "Pregunta", "Respuesta", "Respuesta correcta", "Resultado", "Puntos", "Fecha"].map(csvCell).join(";"),
          ...rows,
        ].join("\n"));
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${event.slug}-contenido.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Captains content ZIP error:", error);
      toast({ title: "Error", description: "No hemos podido descargar todo el contenido.", variant: "destructive" });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  if (codeAccessState === "checking") {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Validando acceso al evento...</main>;
  }
  if (codeAccessState === "invalid") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md rounded-2xl p-8 text-center">
          <KeyRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-bold">Código de acceso no válido</h1>
          <Button className="mt-5" onClick={() => navigate("/admin/capitanes/onboarding")}>Introducir otro código</Button>
        </Card>
      </main>
    );
  }

  return (
	    <AdminFrame
	      title={event.name}
	      backAction={() => navigate("/admin/capitanes")}
	      hideUtilityActions
	      actions={(
	        <Button variant="outline" className="gap-2 rounded-full" onClick={refreshAll}>
	          <RefreshCw className="h-4 w-4" />
	          Actualizar
	        </Button>
	      )}
	    >

	      <Card className="rounded-2xl p-4 shadow-sm">
	        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
	          <div className="flex min-w-0 items-center gap-4">
		            <button
		              type="button"
		              className="shrink-0 border border-border bg-muted/50 p-2 transition hover:bg-muted/50"
		              onClick={() => setQrPreviewOpen(true)}
		              aria-label="Ver QR"
		              title="Ver QR"
		            >
	              <img id="captains-admin-qr" src={qrImageUrl} alt={`QR de ${event.name}`} className="h-20 w-20" />
	            </button>
	            <div className="min-w-0">
	              <div className="flex flex-wrap items-center gap-2">
	                <p className="truncate text-sm font-semibold text-foreground">{event.name}</p>
	                <Badge variant={eventIsFinished ? "outline" : "default"}>{eventStatusLabel}</Badge>
	              </div>
	              <div className="flex min-w-0 items-center gap-1">
	                <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{publicUrl}</a>
	                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleCopy(publicUrl)} aria-label="Copiar enlace" title="Copiar enlace"><Copy className="h-3.5 w-3.5" /></Button>
	              </div>
	              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
	                <p>
	                  <span className="font-medium text-foreground">ID:</span> {event.id}
	                </p>
	                <p>
	                  <span className="font-medium text-foreground">Creación:</span> {formatDateTime(event.created_at)}
	                </p>
	                {event.contact_email ? (
	                  <p>
	                    <span className="font-medium text-foreground">Email:</span> {event.contact_email}
	                  </p>
	                ) : null}
	                {event.contact_phone ? (
	                  <p>
	                    <span className="font-medium text-foreground">Teléfono:</span> {event.contact_phone}
	                  </p>
	                ) : null}
	                {event.contact_name ? (
	                  <p>
	                    <span className="font-medium text-foreground">Contacto:</span> {event.contact_name}
	                  </p>
	                ) : null}
	              </div>
	            </div>
	          </div>
	          <div className="md:min-w-[280px]">
	            <Button variant="outline" size="sm" className="h-auto w-full justify-center gap-4 px-3 py-2 text-xs font-medium text-foreground" onClick={() => setActiveDetailTab("content")}>
	              <span className="inline-flex items-center gap-1 whitespace-nowrap">
	                <ImageIcon className="h-3.5 w-3.5" />
	                {photoCount}
	              </span>
	              <span className="inline-flex items-center gap-1 whitespace-nowrap">
	                <Video className="h-3.5 w-3.5" />
	                {videoCount}
	              </span>
	              <span className="inline-flex items-center gap-1 whitespace-nowrap">
	                <CheckCircle2 className="h-3.5 w-3.5" />
	                {answeredQuestionCount}
	              </span>
	            </Button>
	          </div>
	        </div>
	        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
	          <span className="rounded-full border border-border px-2 py-1">{tables.length} capitanes</span>
	          <span className="rounded-full border border-border px-2 py-1">{challenges.length} retos</span>
	          <span className="rounded-full border border-border px-2 py-1">{liveVisibleEvidence.length} contenidos visibles</span>
	          <span className="rounded-full border border-border px-2 py-1">Última subida: {lastLiveEvidence ? formatDateTime(lastLiveEvidence.created_at) : "-"}</span>
	        </div>
	      </Card>

	      <Tabs value={activeDetailTab} onValueChange={(value) => setActiveDetailTab(value as CaptainsDetailTab)} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 !rounded-none bg-muted/50 p-1 sm:grid-cols-4">
          <TabsTrigger value="general" className="!rounded-none data-[state=active]:!bg-foreground data-[state=active]:!text-background data-[state=active]:shadow-sm">
            General
          </TabsTrigger>
          <TabsTrigger value="tables" className="!rounded-none data-[state=active]:!bg-foreground data-[state=active]:!text-background data-[state=active]:shadow-sm">
	            Capitanes
          </TabsTrigger>
          <TabsTrigger value="challenges" className="!rounded-none data-[state=active]:!bg-foreground data-[state=active]:!text-background data-[state=active]:shadow-sm">
            Retos
          </TabsTrigger>
          <TabsTrigger value="content" className="!rounded-none data-[state=active]:!bg-foreground data-[state=active]:!text-background data-[state=active]:shadow-sm">
            Contenido
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0 space-y-6">
          <Card className="rounded-2xl p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold">General</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Edita la información base del evento como en la pantalla de creación.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Nombre del juego</span>
                    <Input value={generalDraft.name} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, name: inputEvent.target.value }))} />
                  </label>
	                  <label className="space-y-1 md:col-span-2">
	                    <span className="text-xs font-medium text-muted-foreground">Mensaje de bienvenida</span>
	                    <Textarea rows={5} value={generalDraft.description} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, description: inputEvent.target.value }))} />
	                  </label>
	                  <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2 md:grid-cols-3">
	                    <label className="space-y-1">
	                      <span className="text-xs font-medium text-muted-foreground">Nombre contacto</span>
	                      <Input value={generalDraft.contactName} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, contactName: inputEvent.target.value }))} />
	                    </label>
	                    <label className="space-y-1">
	                      <span className="text-xs font-medium text-muted-foreground">Email contacto</span>
	                      <Input type="email" value={generalDraft.contactEmail} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, contactEmail: inputEvent.target.value }))} />
	                    </label>
	                    <label className="space-y-1">
	                      <span className="text-xs font-medium text-muted-foreground">Teléfono contacto</span>
	                      <Input type="tel" value={generalDraft.contactPhone} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, contactPhone: inputEvent.target.value }))} />
	                    </label>
	                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Fin</span>
                      <Input type="date" value={generalDraft.endDate} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, endDate: inputEvent.target.value }))} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Hora</span>
                      <Input type="time" value={generalDraft.endHour} onChange={(inputEvent) => setGeneralDraft((prev) => ({ ...prev, endHour: inputEvent.target.value }))} />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    Al llegar la fecha y hora de fin ya no se podrán completar retos; el ranking y el contenido pasarán a ser públicos para todos los grupos.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className={`text-xs ${generalSaveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                    {generalSaveStatus === "saving"
                      ? "Guardando cambios..."
                      : generalSaveStatus === "error"
                        ? "Revisa los datos: el nombre y una fecha de fin posterior a la creación son obligatorios."
                        : "Los cambios se guardan automáticamente."}
                  </p>
                  <Button variant="outline" className="gap-2 rounded-full" onClick={() => setDeleteEventOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar evento
                  </Button>
                </div>
              </div>
            </div>
          </Card>
	        </TabsContent>

	        <TabsContent value="tables" className="mt-0 space-y-6">
	          <RankingCard
	            ranking={ranking}
	            tableChallengesByTable={tableChallengesByTable}
	            totalChallenges={challenges.length}
	            onEdit={openTableEditor}
	            onResetLastActivity={resetTableLastActivity}
	            onResetAll={resetAllTables}
	            resettingTableId={resettingTableActivityId}
	            isResettingAll={isResettingAllTables}
	          />
	        </TabsContent>

        <TabsContent value="challenges" className="mt-0 space-y-6">
          <Card className="rounded-2xl p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
	              <div>
	                <h2 className="font-semibold">Retos del juego</h2>
	                <p className="text-sm text-muted-foreground">Orden, tipo de evidencia, puntos y reglas de cada reto. Máximo {CAPTAINS_MAX_CHALLENGES}.</p>
	              </div>
	              <Button type="button" className="gap-2 rounded-full" onClick={openAddChallenge} disabled={challenges.length >= CAPTAINS_MAX_CHALLENGES}>
	                <Plus className="h-4 w-4" /> Añadir nuevo reto
	              </Button>
	            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {challenges.map((challenge, index) => (
                <div key={challenge.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase text-muted-foreground">Reto {index + 1}</p>
                      <h3 className="mt-1 font-semibold">{challenge.title}</h3>
                    </div>
	                    <Badge variant="outline" className="rounded-full">{evidenceLabels[challenge.evidence_type]}</Badge>
	                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{challenge.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-1">{challenge.points} pts</span>
                    <span className="rounded-full border border-border px-2 py-1">{difficultyLabels[challenge.difficulty]}</span>
                    <span className="rounded-full border border-border px-2 py-1">
                      {challenge.has_time_limit ? `${challenge.time_limit_seconds}s` : "sin tiempo"}
                    </span>
	                    <span className="rounded-full border border-border px-2 py-1">{challenge.category}</span>
	                  </div>
	                  <Button variant="outline" size="sm" className="mt-4 gap-2 rounded-full" onClick={() => openChallengeEditor(challenge)}>
	                    <Pencil className="h-4 w-4" />
	                    Editar reto
	                  </Button>
	                </div>
	              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-0 space-y-6">
          <Card className="rounded-2xl p-5 shadow-sm">
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
	            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Info label="Visibles" value={String(liveVisibleEvidence.length)} />
              <Info label="Fotos" value={String(photoCount)} />
              <Info label="Vídeos" value={String(videoCount)} />
              <Info label="Respuestas" value={`${answeredQuestionCount}/${questionCount * tables.length}`} />
              <Info label="Última subida" value={lastLiveEvidence ? formatDateTime(lastLiveEvidence.created_at) : "-"} />
            </div>
          </Card>

          <Card className="rounded-2xl p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
	                <h2 className="font-semibold">Contenido subido</h2>
	                <p className="text-sm text-muted-foreground">
	                  Selecciona un {contentView === "retos" ? "reto" : "capitán"} para ver sus archivos y respuestas.
	                </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant={contentView === "retos" ? "default" : "outline"} className="rounded-full" onClick={() => setContentView("retos")}>Ver por retos</Button>
                    <Button type="button" variant={contentView === "capitanes" ? "default" : "outline"} className="rounded-full" onClick={() => setContentView("capitanes")}>Ver por capitanes</Button>
                  </div>
              </div>
              <Button variant="outline" className="gap-2 rounded-full" onClick={handleDownloadAllContent} disabled={(!evidenceIndex.length && answeredQuestionCount === 0) || isDownloadingAll}>
                {isDownloadingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isDownloadingAll ? "Preparando ZIP..." : "Descargar todo"}
              </Button>
            </div>
            {contentGroups.length === 0 ? (
              <EmptyState text="Todavía no se han subido archivos ni guardado respuestas." />
            ) : (
	              <Accordion
	                type="single"
	                collapsible
	                value={openContentGroup}
	                onValueChange={setOpenContentGroup}
	                className="space-y-2"
	              >
	                {contentGroups.map((group) => (
	                  <AccordionItem key={group.id} value={group.id} className="rounded-xl border border-border px-4">
	                    <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
	                      {group.label} ({group.count})
	                    </AccordionTrigger>
	                    <AccordionContent>
	                      {openContentGroup === group.id ? (
	                        isOpenGroupLoading ? (
	                          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
	                            <RefreshCw className="h-4 w-4 animate-spin" /> Cargando contenido...
	                          </div>
	                        ) : openGroupEvidence.length === 0 && activeQuestionAnswers.length === 0 ? (
                          <EmptyState text="Este bloque ya no contiene archivos ni respuestas." />
	                        ) : (
	                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
	                {activeQuestionAnswers.map((row) => {
	                  const table = tables.find((candidate) => candidate.id === row.table_id);
	                  const challenge = challengesById.get(row.challenge_id);
	                  const isCorrect = row.status === "completed";
	                  return (
	                    <Card key={`answer:${row.id}`} className="space-y-3 rounded-2xl p-4 shadow-sm">
	                      <div className="flex items-start justify-between gap-3">
	                        <div className="flex items-center gap-2">
	                          <MessageSquareText className="h-5 w-5 text-primary" />
	                          <p className="font-medium">{challenge?.title || "Pregunta"}</p>
	                        </div>
	                        <Badge variant={isCorrect ? "default" : "outline"}>{isCorrect ? "Correcta" : "Incorrecta"}</Badge>
	                      </div>
	                      <div className="space-y-1 text-sm">
	                        <p className="font-medium">{table?.table_name || "Mesa"}</p>
	                        <p className="text-muted-foreground">{table?.active_captain_name || table?.captain_name || "Sin capitán"}</p>
	                        <div className="rounded-lg bg-muted/40 p-3">
	                          <p className="text-xs font-medium text-muted-foreground">Respuesta</p>
	                          <p className="mt-1 font-medium">{row.question_answer}</p>
	                        </div>
	                        <p className="text-xs text-muted-foreground">Respuesta correcta: {challenge?.question_correct_option || "-"}</p>
	                        <p className="text-xs text-muted-foreground">Tiempo: {row.elapsed_seconds ?? "-"}s · Puntos: {row.points_awarded}</p>
	                        <p className="text-xs text-muted-foreground">{row.submitted_at ? formatDateTime(row.submitted_at) : ""}</p>
	                      </div>
	                    </Card>
	                  );
	                })}
	                {openGroupEvidence.map((item) => {
	                  const table = tables.find((candidate) => candidate.id === item.table_id);
	                  const tableChallenge = tableChallenges.find((candidate) => candidate.id === item.table_challenge_id);
                  const challenge = tableChallenge ? challengesById.get(tableChallenge.challenge_id) : undefined;
                  return (
                    <Card key={item.id} className="space-y-3 rounded-2xl p-3 shadow-sm">
                      <div className="relative">
                        <button type="button" className="block w-full text-left" onClick={() => setSelectedEvidence(item)}>
                          <EvidencePreview evidence={item} />
                        </button>
                        <div className="absolute right-2 top-2 z-10 flex gap-1.5">
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full shadow-sm hover:!bg-[var(--admin-demo2-accent-soft)] hover:!text-foreground" onClick={() => openEvidenceEditor(item)} aria-label="Editar evidencia" title="Editar evidencia">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full shadow-sm hover:!bg-[var(--admin-demo2-accent-soft)] hover:!text-foreground" onClick={() => deleteEvidenceFromCard(item)} aria-label="Eliminar evidencia" title="Eliminar evidencia">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
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
	                        )
	                      ) : null}
	                    </AccordionContent>
	                  </AccordionItem>
	                ))}
	              </Accordion>
            )}
          </Card>
        </TabsContent>
      </Tabs>

		      <Dialog open={!!editingTable} onOpenChange={(open) => { if (!open) void closeTableEditor(); }}>
		        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
		          <DialogHeader>
		            <DialogTitle>Editar capitán</DialogTitle>
		            <DialogDescription>Actualiza todos los detalles de la mesa/capitán: nombres, imagen y aspecto del muñeco.</DialogDescription>
		          </DialogHeader>
		          {tableDraft ? (
		            <div className="space-y-4">
		              <div className="flex flex-wrap items-center justify-center gap-5 rounded-2xl border border-border bg-muted/20 p-4">
		                <CaptainPhotoPreview table={tableDraft} />
		                <CaptainSpritePreview value={tableDraft.captain_sprite} config={tableDraft.captain_sprite_config} />
		              </div>
		              <div className="grid gap-3 sm:grid-cols-2">
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Nombre mesa</span>
		                  <Input value={tableDraft.table_name} onChange={(event) => setTableDraft((prev) => prev ? { ...prev, table_name: event.target.value } : prev)} />
	                </label>
	                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Capitán/a</span>
		                  <Input value={tableDraft.captain_name || ""} onChange={(event) => setTableDraft((prev) => prev ? { ...prev, captain_name: event.target.value } : prev)} />
		                </label>
		                <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2">
		                  <div className="flex items-center justify-between gap-3">
		                    <span className="text-xs font-medium text-muted-foreground">Imagen del capitán/a</span>
		                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
		                      {isUploadingDetailCaptainPhoto ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
		                      {isUploadingDetailCaptainPhoto ? "Subiendo..." : "Subir imagen"}
		                      <input
		                        type="file"
		                        accept="image/*"
		                        className="hidden"
		                        onChange={(event) => {
		                          handleDetailCaptainPhotoSelected(event.target.files?.[0]);
		                          event.currentTarget.value = "";
		                        }}
		                      />
		                    </label>
		                  </div>
		                  {tableDraft.captain_photo_url ? (
		                    <Button type="button" variant="outline" size="sm" className="h-8 gap-2" onClick={() => setTableDraft((prev) => prev ? { ...prev, captain_photo_url: "" } : prev)}>
		                      <X className="h-3.5 w-3.5" />
		                      Quitar imagen
		                    </Button>
		                  ) : (
		                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
		                      <ImageIcon className="h-3.5 w-3.5" />
		                      Si subes una imagen, se verá en la selección de mesa.
		                    </p>
		                  )}
		                </div>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Sexo</span>
		                  <select
		                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
		                    value={tableDraft.captain_sprite_config?.sex || "unspecified"}
		                    onChange={(event) => {
		                      const sex = event.target.value as CaptainsSpriteConfig["sex"];
		                      updateTableDraftSpriteConfig({ sex, outfit_type: sex === "female" ? "dress" : "suit" });
		                    }}
		                  >
		                    <option value="male">Hombre</option>
		                    <option value="female">Mujer</option>
		                    <option value="unspecified">Prefiero no decirlo</option>
		                  </select>
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Pelo</span>
		                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tableDraft.captain_sprite_config?.hair_length || "short"} onChange={(event) => updateTableDraftSpriteConfig({ hair_length: event.target.value as CaptainsSpriteConfig["hair_length"] })}>
		                    <option value="short">Corto</option>
		                    <option value="long">Largo</option>
		                  </select>
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Color pelo</span>
		                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tableDraft.captain_sprite_config?.hair_color || "dark"} onChange={(event) => updateTableDraftSpriteConfig({ hair_color: event.target.value as CaptainsSpriteConfig["hair_color"] })}>
		                    {hairColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
		                  </select>
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Vestuario</span>
		                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tableDraft.captain_sprite_config?.outfit_type || "suit"} onChange={(event) => updateTableDraftSpriteConfig({ outfit_type: event.target.value as CaptainsSpriteConfig["outfit_type"] })}>
		                    <option value="dress">Vestido</option>
		                    <option value="suit">Traje</option>
		                  </select>
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Color piel</span>
		                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={tableDraft.captain_sprite_config?.skin_color || "fair"} onChange={(event) => updateTableDraftSpriteConfig({ skin_color: event.target.value as CaptainsSpriteConfig["skin_color"] })}>
		                    {skinColorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
		                  </select>
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Color vestido</span>
		                  <Input type="color" value={colorValue(tableDraft.captain_sprite_config?.dress_color || "", "#202235")} onChange={(event) => updateTableDraftSpriteConfig({ dress_color: event.target.value })} className="h-10" disabled={tableDraft.captain_sprite_config?.outfit_type !== "dress"} />
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Color traje</span>
		                  <Input type="color" value={colorValue(tableDraft.captain_sprite_config?.suit_color || "", "#1f2937")} onChange={(event) => updateTableDraftSpriteConfig({ suit_color: event.target.value })} className="h-10" disabled={tableDraft.captain_sprite_config?.outfit_type !== "suit"} />
		                </label>
		                <label className="space-y-1">
		                  <span className="text-xs font-medium text-muted-foreground">Color corbata</span>
		                  <Input type="color" value={colorValue(tableDraft.captain_sprite_config?.tie_color || "", "#f06a5f")} onChange={(event) => updateTableDraftSpriteConfig({ tie_color: event.target.value })} className="h-10" disabled={tableDraft.captain_sprite_config?.outfit_type !== "suit"} />
		                </label>
		              </div>
		              <p className={`text-right text-xs ${tableSaveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
		                {tableSaveStatus === "saving"
		                  ? "Guardando cambios..."
		                  : tableSaveStatus === "error"
		                    ? "No se han podido guardar los cambios."
		                    : tableSaveStatus === "saved"
		                      ? "Cambios guardados automáticamente."
		                      : "Los cambios se guardan automáticamente."}
		              </p>
	            </div>
	          ) : null}
		        </DialogContent>
		      </Dialog>

		      <Dialog open={Boolean(detailCaptainPhotoCrop)} onOpenChange={(open) => { if (!open) closeDetailCaptainPhotoCrop(); }}>
		        <DialogContent className="max-w-lg">
		          <DialogHeader>
		            <DialogTitle>Encuadrar imagen del capitán</DialogTitle>
		            <DialogDescription>Ajusta el encuadre circular antes de guardarlo.</DialogDescription>
		          </DialogHeader>
		          {detailCaptainPhotoCrop ? (
		            <div className="space-y-4">
		              <div className="mx-auto flex h-64 w-64 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
		                <img
		                  src={detailCaptainPhotoCrop.previewUrl}
		                  alt=""
		                  className="h-full w-full object-cover"
		                  style={{
		                    transform: `translate(${detailCaptainPhotoCrop.offsetX}%, ${detailCaptainPhotoCrop.offsetY}%) scale(${detailCaptainPhotoCrop.zoom})`,
		                  }}
		                />
		              </div>
		              <div className="grid gap-3">
		                <label className="space-y-1">
		                  <span className="text-sm font-medium">Zoom</span>
		                  <Input type="range" min="1" max="2.6" step="0.05" value={detailCaptainPhotoCrop.zoom} onChange={(event) => setDetailCaptainPhotoCrop((prev) => prev ? { ...prev, zoom: Number(event.target.value) } : prev)} />
		                </label>
		                <label className="space-y-1">
		                  <span className="text-sm font-medium">Mover horizontal</span>
		                  <Input type="range" min="-35" max="35" step="1" value={detailCaptainPhotoCrop.offsetX} onChange={(event) => setDetailCaptainPhotoCrop((prev) => prev ? { ...prev, offsetX: Number(event.target.value) } : prev)} />
		                </label>
		                <label className="space-y-1">
		                  <span className="text-sm font-medium">Mover vertical</span>
		                  <Input type="range" min="-35" max="35" step="1" value={detailCaptainPhotoCrop.offsetY} onChange={(event) => setDetailCaptainPhotoCrop((prev) => prev ? { ...prev, offsetY: Number(event.target.value) } : prev)} />
		                </label>
		              </div>
		              <div className="flex justify-end gap-2">
		                <Button variant="outline" onClick={closeDetailCaptainPhotoCrop}>Cancelar</Button>
		                <Button onClick={handleDetailCaptainPhotoUpload} disabled={isUploadingDetailCaptainPhoto}>
		                  {isUploadingDetailCaptainPhoto ? "Subiendo..." : "Guardar encuadre"}
		                </Button>
		              </div>
		            </div>
		          ) : null}
		        </DialogContent>
		      </Dialog>

	      <Dialog open={!!editingChallenge} onOpenChange={(open) => { if (!open) { setEditingChallenge(null); setChallengeDraft(null); } }}>
	        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
	          <DialogHeader>
	            <DialogTitle>Editar reto</DialogTitle>
	            <DialogDescription>Solo se modifica este reto dentro de este evento, no el catálogo general.</DialogDescription>
	          </DialogHeader>
	          {challengeDraft ? (
	            <div className="space-y-4">
	              <ChallengeEditor challenge={challengeDraft} index={(challengeDraft.order_index || 1) - 1} onChange={setChallengeDraft} onDelete={() => { setEditingChallenge(null); setChallengeDraft(null); }} />
	              <div className="flex justify-end gap-2">
	                <Button variant="outline" onClick={() => { setEditingChallenge(null); setChallengeDraft(null); }}>Cancelar</Button>
	                <Button onClick={saveChallengeEditor} disabled={isDetailSaving}>{isDetailSaving ? "Guardando..." : "Guardar reto"}</Button>
	              </div>
	            </div>
	          ) : null}
	        </DialogContent>
	      </Dialog>

        <Dialog open={addChallengeOpen} onOpenChange={setAddChallengeOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Añadir nuevo reto</DialogTitle>
              <DialogDescription>Elige un reto del catálogo o crea uno manualmente. El máximo general es de {CAPTAINS_MAX_CHALLENGES} retos.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Button type="button" variant={addChallengeMode === "catalog" ? "default" : "outline"} className="rounded-full" onClick={() => setAddChallengeMode("catalog")}>Catálogo</Button>
              <Button type="button" variant={addChallengeMode === "manual" ? "default" : "outline"} className="rounded-full" onClick={() => setAddChallengeMode("manual")}>Creación manual</Button>
            </div>
            {addChallengeMode === "catalog" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {challengeCatalog.map((catalogItem) => (
                  <div key={catalogItem.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{catalogItem.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{catalogItem.description}</p>
                      </div>
                      <Badge variant="outline">{catalogItem.default_points} pts</Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 w-full rounded-full"
                      onClick={() => addCatalogChallenge(catalogItem.id)}
                      disabled={isDetailSaving || isCatalogChallengeAdded(catalogItem)}
                    >
                      {isCatalogChallengeAdded(catalogItem) ? "Ya añadido" : "Añadir este reto"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <ChallengeEditor challenge={newChallengeDraft} index={detail?.challenges.length || 0} onChange={setNewChallengeDraft} onDelete={() => setAddChallengeOpen(false)} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddChallengeOpen(false)}>Cancelar</Button>
                  <Button type="button" onClick={addManualChallenge} disabled={isDetailSaving}>{isDetailSaving ? "Añadiendo..." : "Añadir reto"}</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

	      <Dialog open={!!editingEvidence} onOpenChange={(open) => { if (!open) setEditingEvidence(null); }}>
	        <DialogContent className="max-w-lg">
	          <DialogHeader>
	            <DialogTitle>Editar contenido</DialogTitle>
	            <DialogDescription>Cambia estado, puntos y comentario interno de esta evidencia.</DialogDescription>
	          </DialogHeader>
	          <div className="space-y-4">
	            <label className="space-y-1">
	              <span className="text-xs font-medium text-muted-foreground">Estado</span>
	              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={evidenceDraft.status} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, status: event.target.value as CaptainsEvidence["status"] }))}>
	                <option value="uploaded">Subido</option>
	                <option value="pending_review">Pendiente revisión</option>
	                <option value="approved">Aprobado</option>
	                <option value="rejected">Rechazado</option>
	                <option value="deleted">Eliminado</option>
	              </select>
	            </label>
	            <label className="space-y-1">
	              <span className="text-xs font-medium text-muted-foreground">Puntos</span>
	              <Input type="number" min={0} value={evidenceDraft.points} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, points: Number(event.target.value) }))} />
	            </label>
	            <label className="space-y-1">
	              <span className="text-xs font-medium text-muted-foreground">Comentario</span>
	              <Textarea rows={3} value={evidenceDraft.comment} onChange={(event) => setEvidenceDraft((prev) => ({ ...prev, comment: event.target.value }))} />
	            </label>
	            <div className="flex justify-end gap-2">
	              <Button variant="outline" onClick={() => setEditingEvidence(null)}>Cancelar</Button>
	              <Button onClick={saveEvidenceEditor} disabled={isDetailSaving}>{isDetailSaving ? "Guardando..." : "Guardar"}</Button>
	            </div>
	          </div>
	        </DialogContent>
	      </Dialog>

	      <Dialog open={!!selectedEvidence} onOpenChange={(open) => !open && setSelectedEvidence(null)}>
	        <DialogContent className="max-w-3xl">
	          <DialogHeader>
	            <DialogTitle>Evidencia</DialogTitle>
	            <DialogDescription>Vista previa de la evidencia subida por la mesa.</DialogDescription>
	          </DialogHeader>
	          {selectedEvidence ? <EvidencePreview evidence={selectedEvidence} /> : null}
	        </DialogContent>
	      </Dialog>
	      <Dialog open={deleteEventOpen} onOpenChange={setDeleteEventOpen}>
	        <DialogContent className="max-w-md">
	          <DialogHeader>
	            <DialogTitle>¿Eliminar este evento?</DialogTitle>
	            <DialogDescription>Se perderán definitivamente todas las mesas, retos, puntuaciones, fotos y vídeos. Esta acción no se puede deshacer.</DialogDescription>
	          </DialogHeader>
	          <div className="flex justify-end gap-2">
	            <Button variant="outline" onClick={() => setDeleteEventOpen(false)}>Cancelar</Button>
	            <Button className="bg-black text-white hover:bg-black/85" onClick={handleDeleteEvent}>Sí, eliminar todo</Button>
	          </div>
	        </DialogContent>
	      </Dialog>
	      {qrPreviewOpen && (
	        <div
	          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
	          onClick={() => setQrPreviewOpen(false)}
	        >
	          <button
	            type="button"
	            className="absolute right-4 top-4 text-3xl leading-none text-white"
	            aria-label="Cerrar"
	            onClick={() => setQrPreviewOpen(false)}
	          >
	            ×
	          </button>
	          <div
	            className="flex max-h-[92vh] w-[min(90vw,720px)] flex-col gap-3 bg-white p-4"
	            onClick={(event) => event.stopPropagation()}
	          >
	            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
	              <img src={qrImageUrl} alt={`QR de ${event.name}`} className="h-auto max-h-[75vh] w-full object-contain" />
	            </div>
	            <Button className="w-full gap-2" onClick={handleDownloadQr}><Download className="h-4 w-4" />Descargar QR</Button>
	          </div>
	        </div>
	      )}
	    </AdminFrame>
	  );
	};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm font-semibold">{value}</p>
  </div>
);

const RankingCard = ({
  ranking,
  tableChallengesByTable,
  totalChallenges,
  onEdit,
  onResetLastActivity,
  onResetAll,
  resettingTableId,
  isResettingAll,
}: {
  ranking: CaptainsRankingItem[];
  tableChallengesByTable: Map<string, CaptainsTableChallenge[]>;
  totalChallenges: number;
  onEdit: (table: CaptainsTable) => void;
  onResetLastActivity: (table: CaptainsTable) => void;
  onResetAll: () => void;
  resettingTableId: string;
  isResettingAll: boolean;
}) => (
  <Card className="rounded-2xl p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">Ranking en tiempo real</h2>
      <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={onResetAll} disabled={isResettingAll || ranking.length === 0}>
        <RefreshCw className={`h-4 w-4 ${isResettingAll ? "animate-spin" : ""}`} />
        {isResettingAll ? "Reseteando..." : "Resetear todos"}
      </Button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-separate border-spacing-y-3 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground">
            <th className="px-3 py-2 font-medium">Posición</th>
            <th className="px-3 py-2 font-medium">Mesa</th>
            <th className="px-3 py-2 font-medium">Estética</th>
            <th className="px-3 py-2 font-medium">Capitán</th>
            <th className="px-3 py-2 font-medium">Puntos</th>
            <th className="px-3 py-2 font-medium">Completados</th>
            <th className="px-3 py-2 font-medium">Fallidos</th>
            <th className="px-3 py-2 font-medium">Pendientes</th>
            <th className="px-3 py-2 font-medium">Última actividad</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((table, index) => {
            const rows = tableChallengesByTable.get(table.id) || [];
            const finished = rows.filter((row) => finishedTableChallengeStatuses.has(row.status)).length;
            const pending = Math.max(0, totalChallenges - finished);
            return (
              <tr
                key={table.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer bg-card shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onEdit(table)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                    keyboardEvent.preventDefault();
                    onEdit(table);
                  }
                }}
              >
                <td className="px-3 py-4 font-semibold">#{table.rank || index + 1}</td>
                <td className="px-3 py-4">{table.table_name}</td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <CaptainPhotoPreview table={table} size="sm" />
                    <CaptainSpritePreview value={table.captain_sprite} config={table.captain_sprite_config} size="sm" />
                    {table.captain_sprite_config?.outfit_type === "dress" ? "Vestido" : "Traje"}
                  </div>
                </td>
                <td className="px-3 py-4">{table.active_captain_name || table.captain_name || "-"}</td>
                <td className="px-3 py-4">{table.total_points}</td>
                <td className="px-3 py-4">{table.completed_challenges}</td>
                <td className="px-3 py-4">{table.failed_challenges}</td>
                <td className="px-3 py-4">{pending}</td>
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2">
                    <span>{formatDateTime(table.last_activity_at)}</span>
                    {table.last_activity_at ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 rounded-full"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onResetLastActivity(table);
                        }}
                        onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
                        disabled={resettingTableId === table.id}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${resettingTableId === table.id ? "animate-spin" : ""}`} />
                        Resetear
                      </Button>
                    ) : null}
                  </div>
                </td>
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
  <Card className="rounded-2xl p-5 shadow-sm">
    <h2 className="mb-4 font-semibold">Progreso por mesa</h2>
    {tables.length === 0 ? (
      <EmptyState text="Añade al menos una mesa para crear el juego." />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-y-3 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mesa</th>
              <th className="px-3 py-2 font-medium">Estética</th>
              <th className="px-3 py-2 font-medium">Capitán</th>
              <th className="px-3 py-2 font-medium">Reto actual</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Tiempo restante</th>
              <th className="px-3 py-2 font-medium">Puntos</th>
              <th className="px-3 py-2 font-medium">Progreso</th>
              <th className="px-3 py-2 font-medium">Última evidencia</th>
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
                <tr key={table.id} className="bg-card shadow-sm">
                  <td className="rounded-l-xl border-y border-l border-border px-3 py-4">{table.table_name}</td>
                  <td className="border-y border-border px-3 py-4">
                    <div className="flex items-center gap-2">
                      <CaptainPhotoPreview table={table} size="sm" />
                      <CaptainSpritePreview value={table.captain_sprite} config={table.captain_sprite_config} size="sm" />
                      {table.captain_sprite_config?.outfit_type === "dress" ? "Vestido" : "Traje"}
                    </div>
                  </td>
                  <td className="border-y border-border px-3 py-4">{table.active_captain_name || table.captain_name || "-"}</td>
                  <td className="border-y border-border px-3 py-4">{challenge ? `${currentIndex}/${totalChallenges} · ${challenge.title}` : "-"}</td>
                  <td className="border-y border-border px-3 py-4">{current ? statusLabels[current.status] : "-"}</td>
                  <td className="border-y border-border px-3 py-4">{current?.remaining_seconds != null ? `${current.remaining_seconds}s` : "-"}</td>
                  <td className="border-y border-border px-3 py-4">{table.total_points}</td>
                  <td className="border-y border-border px-3 py-4">
                    {table.completed_challenges}/{totalChallenges}
                  </td>
                  <td className="rounded-r-xl border-y border-r border-border px-3 py-4">{evidence ? formatDateTime(evidence.created_at) : "-"}</td>
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
