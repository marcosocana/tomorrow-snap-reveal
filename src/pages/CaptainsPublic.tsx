import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  completeCaptainsQuestionChallenge,
  expireCaptainsTableChallenge,
  failCaptainsTableChallenge,
  generateRandomChallengeOrderForTable,
  getCaptainsEvidence,
  getCaptainsEvidenceSignedUrl,
  getCaptainsRanking,
  getCaptainsTableChallenges,
  getCaptainsTableChallengesForTable,
  selectCaptainsTableSession,
  startCaptainsTableChallenge,
  uploadCaptainsEvidence,
} from "@/lib/captainsService";
import type {
  CaptainsEventChallenge,
  CaptainsEventDetail,
  CaptainsEvidence,
  CaptainsEvidenceType,
  CaptainsRankingItem,
  CaptainsSpriteConfig,
  CaptainsSpriteStyle,
  CaptainsTable,
  CaptainsTableChallenge,
  CaptainsThemeStyle,
} from "@/lib/captainsTypes";
import { useCaptainsEventDetail } from "@/hooks/useCaptains";
// Public Captains screen: all Supabase calls go through captainsService, which
// uses the anonymous supabasePublic client — never the admin auth client.
import { calculateCaptainsAutomaticScore, getCaptainsPublicUrl, normalizeCaptainsPublicUrl, shuffleCaptainsItems } from "@/lib/captainsUtils";
import { cn } from "@/lib/utils";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Eye,
  Film,
  Flame,
  Image as ImageIcon,
  Loader2,
  Medal,
  RefreshCw,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type React from "react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type PublicStep = "home" | "start" | "play" | "ranking" | "final" | "live" | "resumen";
type ChallengePhase = "intro" | "preview" | "progress" | "result" | "expired";
type ResultKind = "success" | "manual" | "failed" | "expired";
type EvidenceFilter = "all" | "mine" | "others" | CaptainsEvidenceType;
type SummaryMode = "tables" | "challenges";

const DEFAULT_CAPTAINS_PRIMARY = "#f06a5f";
const DEFAULT_CAPTAINS_SECONDARY = "#2f292d";
const DEFAULT_CAPTAINS_BACKGROUND = "none";

const isThemeColor = (value?: string | null) => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
const cssUrl = (value?: string | null) => (value ? `url("${value.replace(/"/g, "%22")}")` : DEFAULT_CAPTAINS_BACKGROUND);

const demoWeddingBackground = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1600"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#5d4640"/><stop offset=".52" stop-color="#2f292d"/><stop offset="1" stop-color="#1c2226"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="900" height="1600" fill="url(#g)"/><g opacity=".5" filter="url(#b)"><circle cx="120" cy="230" r="190" fill="#f3dfc1"/><circle cx="760" cy="1180" r="260" fill="#d8a35d"/></g><g fill="none" stroke="#f3dfc1" stroke-width="5" opacity=".34"><path d="M110 1380c130-210 300-250 520-160"/><path d="M185 1298c40-80 112-114 205-104"/><path d="M560 1240c78-54 150-62 228-24"/></g><g fill="#f3dfc1" opacity=".26"><circle cx="205" cy="290" r="6"/><circle cx="682" cy="410" r="5"/><circle cx="760" cy="730" r="4"/><circle cx="160" cy="980" r="5"/><circle cx="610" cy="1390" r="6"/></g></svg>`,
)}`;

interface CaptainSession {
  table_id: string;
  table_name: string;
  captain_name: string;
  session_token: string;
  selected_at: string;
  user_agent: string;
  device_info: Record<string, unknown> | null;
}

const terminalStatuses = new Set(["completed", "failed", "time_expired", "pending_review", "rejected", "deleted"]);
const DEMO_SLUG = "demo-capitanes";
const DEMO_EVENT_ID = "de000000-0000-4000-8000-000000000001";
const DEMO_TABLE_IDS = [
  "db000000-0000-4000-8000-000000000001",
  "db000000-0000-4000-8000-000000000002",
  "db000000-0000-4000-8000-000000000003",
  "db000000-0000-4000-8000-000000000004",
  "db000000-0000-4000-8000-000000000005",
] as const;
const DEMO_CHALLENGE_IDS = [
  "dc000000-0000-4000-8000-000000000001",
  "dc000000-0000-4000-8000-000000000002",
  "dc000000-0000-4000-8000-000000000003",
  "dc000000-0000-4000-8000-000000000004",
  "dc000000-0000-4000-8000-000000000005",
] as const;

const sessionKey = (slug: string) => `captains-session:${slug}`;
const demoRowsKey = (slug: string, tableId: string) => `captains-demo-rows:${slug}:${tableId}`;
const demoEvidenceKey = (slug: string) => `captains-demo-evidence:${slug}`;

const resetDemoGameStorage = (slug: string) => {
  const rowsPrefix = `captains-demo-rows:${slug}:`;
  const keysToRemove = [sessionKey(slug), demoEvidenceKey(slug)];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(rowsPrefix)) keysToRemove.push(key);
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

const nowIso = () => new Date().toISOString();

const demoEventDetail: CaptainsEventDetail = {
  event: {
    id: DEMO_EVENT_ID,
    name: "Demo Capitanes by Revelao",
    slug: DEMO_SLUG,
    description:
      "Una partida de prueba para ver la experiencia pública: mesas, retos, puntos, ranking y recuerdos en directo.",
    start_time: null,
    end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scoring_mode: "automatic",
    status: "active",
    show_live_gallery_after_completion: true,
    theme_style: "pixel",
    primary_color: DEFAULT_CAPTAINS_PRIMARY,
    secondary_color: DEFAULT_CAPTAINS_SECONDARY,
    background_image_url: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    qr_url: `/capitanes/${DEMO_SLUG}`,
    public_url: `/capitanes/${DEMO_SLUG}`,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  tables: [
    {
      id: DEMO_TABLE_IDS[0],
      event_id: DEMO_EVENT_ID,
      table_number: 1,
      table_name: "Mesa 1",
      captain_name: "Jorge",
      active_captain_name: "Jorge",
      captain_photo_url: null,
      captain_sprite: "suit",
      captain_sprite_config: {
        sex: "male",
        hair_length: "short",
        hair_color: "brown",
        skin_color: "fair",
        outfit_type: "suit",
        dress_color: "#202235",
        suit_color: "#1f2937",
        tie_color: "#f06a5f",
      },
      session_token: "demo-session-1",
      total_points: 35,
      completed_challenges: 2,
      failed_challenges: 0,
      current_challenge_id: null,
      last_activity_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_TABLE_IDS[1],
      event_id: DEMO_EVENT_ID,
      table_number: 2,
      table_name: "Mesa 2",
      captain_name: "Marta",
      active_captain_name: "Marta",
      captain_photo_url: null,
      captain_sprite: "dress",
      captain_sprite_config: {
        sex: "female",
        hair_length: "long",
        hair_color: "brown",
        skin_color: "very_fair",
        outfit_type: "dress",
        dress_color: "#202235",
        suit_color: "#1f2937",
        tie_color: "#f06a5f",
      },
      session_token: "demo-session-2",
      total_points: 22,
      completed_challenges: 1,
      failed_challenges: 1,
      current_challenge_id: null,
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_TABLE_IDS[2],
      event_id: DEMO_EVENT_ID,
      table_number: 3,
      table_name: "Mesa 3",
      captain_name: "Laura",
      active_captain_name: "Laura",
      captain_photo_url: null,
      captain_sprite: "jacket",
      captain_sprite_config: {
        sex: "female",
        hair_length: "short",
        hair_color: "dark",
        skin_color: "tan",
        outfit_type: "suit",
        dress_color: "#6fa341",
        suit_color: "#4f7f3a",
        tie_color: "#ffffff",
      },
      session_token: "demo-session-3",
      total_points: 16,
      completed_challenges: 1,
      failed_challenges: 0,
      current_challenge_id: null,
      last_activity_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_TABLE_IDS[3],
      event_id: DEMO_EVENT_ID,
      table_number: 4,
      table_name: "Mesa 4",
      captain_name: "Dani",
      active_captain_name: "Dani",
      captain_photo_url: null,
      captain_sprite: "festival",
      captain_sprite_config: {
        sex: "male",
        hair_length: "short",
        hair_color: "dark",
        skin_color: "dark",
        outfit_type: "suit",
        dress_color: "#8a4f22",
        suit_color: "#8a4f22",
        tie_color: "#f8d24a",
      },
      session_token: "demo-session-4",
      total_points: 0,
      completed_challenges: 0,
      failed_challenges: 0,
      current_challenge_id: null,
      last_activity_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_TABLE_IDS[4],
      event_id: DEMO_EVENT_ID,
      table_number: 5,
      table_name: "Mesa 5",
      captain_name: null,
      active_captain_name: null,
      captain_photo_url: null,
      captain_sprite: "uniform",
      captain_sprite_config: {
        sex: "female",
        hair_length: "long",
        hair_color: "blonde",
        skin_color: "fair",
        outfit_type: "dress",
        dress_color: "#d32027",
        suit_color: "#1f2937",
        tie_color: "#f06a5f",
      },
      session_token: "demo-session-5",
      total_points: 0,
      completed_challenges: 0,
      failed_challenges: 0,
      current_challenge_id: null,
      last_activity_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ],
  challenges: [
    {
      id: DEMO_CHALLENGE_IDS[0],
      event_id: DEMO_EVENT_ID,
      catalog_challenge_id: null,
      title: "Brindis de mesa",
      description: "Haced una foto de toda la mesa brindando por los novios.",
      evidence_type: "photo",
      points: 20,
      category: "Mesa",
      difficulty: "easy",
      has_time_limit: false,
      time_limit_seconds: null,
      question_options: null,
      question_correct_option: null,
      order_index: 1,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_CHALLENGE_IDS[1],
      event_id: DEMO_EVENT_ID,
      catalog_challenge_id: null,
      title: "Pregunta de pareja",
      description: "¿Dónde fue la primera cita de la pareja?",
      evidence_type: "question",
      points: 15,
      category: "Pregunta",
      difficulty: "medium",
      has_time_limit: true,
      time_limit_seconds: 60,
      question_options: ["En un restaurante", "En la playa", "En un concierto", "En casa de amigos"],
      question_correct_option: "En un restaurante",
      order_index: 2,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_CHALLENGE_IDS[2],
      event_id: DEMO_EVENT_ID,
      catalog_challenge_id: null,
      title: "Mensaje secreto",
      description: "Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.",
      evidence_type: "video",
      points: 25,
      category: "Emotivo",
      difficulty: "special",
      has_time_limit: true,
      time_limit_seconds: 90,
      question_options: null,
      question_correct_option: null,
      order_index: 3,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_CHALLENGE_IDS[3],
      event_id: DEMO_EVENT_ID,
      catalog_challenge_id: null,
      title: "Aliados de otra mesa",
      description: "Haced una foto con alguien de otra mesa.",
      evidence_type: "photo",
      points: 15,
      category: "Interacción",
      difficulty: "medium",
      has_time_limit: false,
      time_limit_seconds: null,
      question_options: null,
      question_correct_option: null,
      order_index: 4,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: DEMO_CHALLENGE_IDS[4],
      event_id: DEMO_EVENT_ID,
      catalog_challenge_id: null,
      title: "Coreografía exprés",
      description: "Grabad un vídeo corto con toda la mesa haciendo vuestra mejor coreografía.",
      evidence_type: "video",
      points: 20,
      category: "Fiesta",
      difficulty: "medium",
      has_time_limit: true,
      time_limit_seconds: 90,
      question_options: null,
      question_correct_option: null,
      order_index: 5,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ],
};

const makeDemoSvg = (title: string, subtitle: string, color = "#2dd4bf") =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 675"><rect width="900" height="675" fill="#101827"/><rect x="36" y="36" width="828" height="603" rx="24" fill="${color}" opacity=".18" stroke="${color}" stroke-width="8"/><circle cx="730" cy="150" r="70" fill="#facc15"/><text x="70" y="300" font-family="Arial" font-size="64" font-weight="900" fill="#ffffff">${title}</text><text x="72" y="378" font-family="Arial" font-size="34" font-weight="700" fill="#cbd5e1">${subtitle}</text><text x="72" y="560" font-family="Arial" font-size="28" font-weight="900" fill="${color}">Capitanes by Revelao</text></svg>`,
  )}`;

const demoSummaryEvidence = (): CaptainsEvidence[] => [
  {
    id: "demo-sample-evidence-1",
    event_id: DEMO_EVENT_ID,
    table_id: DEMO_TABLE_IDS[0],
    table_challenge_id: "demo-sample-row-1",
    captain_name: "Jorge",
    evidence_type: "photo",
    file_url: makeDemoSvg("Mesa 1", "Brindis de mesa", "#2dd4bf"),
    thumbnail_url: null,
    status: "approved",
    points_awarded: 20,
    admin_comment: null,
    elapsed_seconds: null,
    remaining_seconds: null,
    created_at: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    reviewed_at: nowIso(),
    deleted_at: null,
  },
  {
    id: "demo-sample-evidence-2",
    event_id: DEMO_EVENT_ID,
    table_id: DEMO_TABLE_IDS[1],
    table_challenge_id: "demo-sample-row-2",
    captain_name: "Marta",
    evidence_type: "photo",
    file_url: makeDemoSvg("Mesa 2", "Brindis de mesa", "#fb7185"),
    thumbnail_url: null,
    status: "approved",
    points_awarded: 18,
    admin_comment: null,
    elapsed_seconds: null,
    remaining_seconds: null,
    created_at: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
    reviewed_at: nowIso(),
    deleted_at: null,
  },
  {
    id: "demo-sample-evidence-3",
    event_id: DEMO_EVENT_ID,
    table_id: DEMO_TABLE_IDS[2],
    table_challenge_id: "demo-sample-row-3",
    captain_name: "Laura",
    evidence_type: "photo",
    file_url: makeDemoSvg("Mesa 3", "Aliados de otra mesa", "#facc15"),
    thumbnail_url: null,
    status: "approved",
    points_awarded: 14,
    admin_comment: null,
    elapsed_seconds: 38,
    remaining_seconds: 22,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    reviewed_at: nowIso(),
    deleted_at: null,
  },
  {
    id: "demo-sample-evidence-4",
    event_id: DEMO_EVENT_ID,
    table_id: DEMO_TABLE_IDS[0],
    table_challenge_id: "demo-sample-row-4",
    captain_name: "Jorge",
    evidence_type: "video",
    file_url: makeDemoSvg("Mesa 1", "Mensaje secreto", "#a78bfa"),
    thumbnail_url: null,
    status: "approved",
    points_awarded: 21,
    admin_comment: null,
    elapsed_seconds: 52,
    remaining_seconds: 38,
    created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    reviewed_at: nowIso(),
    deleted_at: null,
  },
];

const demoSampleRows = (): CaptainsTableChallenge[] => [
  ["demo-sample-row-1", DEMO_TABLE_IDS[0], DEMO_CHALLENGE_IDS[0], 1],
  ["demo-sample-row-2", DEMO_TABLE_IDS[1], DEMO_CHALLENGE_IDS[0], 1],
  ["demo-sample-row-3", DEMO_TABLE_IDS[2], DEMO_CHALLENGE_IDS[3], 4],
  ["demo-sample-row-4", DEMO_TABLE_IDS[0], DEMO_CHALLENGE_IDS[2], 3],
].map(([id, tableId, challengeId, order]) => ({
  id: String(id),
  event_id: DEMO_EVENT_ID,
  table_id: String(tableId),
  challenge_id: String(challengeId),
  randomized_order_index: Number(order),
  status: "completed",
  points_awarded: 0,
  started_at: null,
  submitted_at: nowIso(),
  elapsed_seconds: null,
  remaining_seconds: null,
  is_time_expired: false,
  automatic_score_calculated: true,
  reviewed_at: nowIso(),
  created_at: nowIso(),
  updated_at: nowIso(),
})) as CaptainsTableChallenge[];

const getPublicStep = (pathname: string): PublicStep => {
  if (pathname.endsWith("/start")) return "start";
  if (pathname.endsWith("/play")) return "play";
  if (pathname.endsWith("/ranking")) return "ranking";
  if (pathname.endsWith("/final")) return "final";
  if (pathname.endsWith("/live")) return "live";
  if (pathname.endsWith("/resumen")) return "resumen";
  return "home";
};

const formatClock = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const formatRelativeTime = (value: string) => {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (diff < 60) return "Hace menos de 1 min";
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
};

const evidenceLabel: Record<CaptainsEvidenceType, string> = {
  photo: "Foto",
  video: "Vídeo",
  question: "Pregunta",
};

const evidenceAccept: Record<Exclude<CaptainsEvidenceType, "question">, string> = {
  photo: "image/*",
  video: "video/*",
};

const evidenceActionLabel: Record<Exclude<CaptainsEvidenceType, "question">, string> = {
  photo: "Hacer foto",
  video: "Hacer vídeo",
};

const evidenceRetakeLabel: Record<Exclude<CaptainsEvidenceType, "question">, string> = {
  photo: "Repetir foto",
  video: "Grabar otro vídeo",
};

const evidenceConfirmLabel: Record<Exclude<CaptainsEvidenceType, "question">, string> = {
  photo: "Usar foto",
  video: "Usar vídeo",
};

const evidenceCapture: Record<Exclude<CaptainsEvidenceType, "question">, "environment" | "user"> = {
  photo: "environment",
  video: "environment",
};

const EvidenceIcon = ({ type, className }: { type: CaptainsEvidenceType; className?: string }) => {
  const Icon = type === "photo" ? Camera : type === "video" ? Film : Sparkles;
  return <Icon className={className} />;
};

const spritePalettes: Record<
  CaptainsSpriteStyle,
  { hair: string; skin: string; outfit: string; accent: string; legs: string; style: CaptainsSpriteStyle }
> = {
  suit: { hair: "#3f2d23", skin: "#f0bd91", outfit: "#1f2937", accent: "#ffffff", legs: "#111827", style: "suit" },
  dress: { hair: "#5a3828", skin: "#f1c09a", outfit: "#202235", accent: "#ffffff", legs: "#202235", style: "dress" },
  jacket: { hair: "#111111", skin: "#8f5f3d", outfit: "#4f7f3a", accent: "#ffffff", legs: "#3b2f24", style: "jacket" },
  skirt: { hair: "#1f1712", skin: "#9b6747", outfit: "#4c7d3f", accent: "#ffffff", legs: "#3b2f24", style: "skirt" },
  festival: { hair: "#2b1b12", skin: "#efb68c", outfit: "#8a4f22", accent: "#f06a5f", legs: "#654321", style: "festival" },
  tunic: { hair: "#c9c9c9", skin: "#a87450", outfit: "#d5d5d5", accent: "#ffffff", legs: "#1f2937", style: "tunic" },
  uniform: { hair: "#141414", skin: "#edb28f", outfit: "#d32027", accent: "#f8d24a", legs: "#d32027", style: "uniform" },
  kimono: { hair: "#1c1c1c", skin: "#f2bd93", outfit: "#6fa341", accent: "#111111", legs: "#202235", style: "kimono" },
};

const spriteStyleOrder = Object.keys(spritePalettes) as CaptainsSpriteStyle[];
const spriteHairColors: Record<CaptainsSpriteConfig["hair_color"], string> = {
  blonde: "#e8c85b",
  dark: "#151515",
  brown: "#6b4328",
};
const spriteSkinColors: Record<CaptainsSpriteConfig["skin_color"], string> = {
  very_fair: "#f4d6c6",
  fair: "#e9b98f",
  tan: "#a66b45",
  dark: "#5d3828",
};
const spriteHexColor = (value: string | undefined, fallback: string) => (value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback);

const getSpritePalette = (seed: number | string) => {
  const index =
    typeof seed === "number"
      ? seed
      : seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return spritePalettes[spriteStyleOrder[Math.abs(index) % spriteStyleOrder.length]];
};

const getSpritePaletteFromConfig = (config?: CaptainsSpriteConfig | null) => {
  if (!config) return null;
  const outfit = config.outfit_type === "dress" ? spriteHexColor(config.dress_color, "#202235") : spriteHexColor(config.suit_color, "#1f2937");
  return {
    hair: spriteHairColors[config.hair_color] || "#151515",
    skin: spriteSkinColors[config.skin_color] || "#e9b98f",
    outfit,
    accent: config.outfit_type === "dress" ? "#ffffff" : spriteHexColor(config.tie_color, "#f06a5f"),
    legs: config.outfit_type === "dress" ? "#202235" : outfit,
    style: config.outfit_type === "dress" ? "dress" as CaptainsSpriteStyle : "suit" as CaptainsSpriteStyle,
    longHair: config.hair_length === "long",
  };
};

const PixelCaptainSprite = ({
  table,
  active = false,
  size = "md",
}: {
  table?: Pick<CaptainsTable, "id" | "table_number" | "captain_name" | "active_captain_name" | "captain_sprite" | "captain_sprite_config"> | null;
  active?: boolean;
  size?: "sm" | "md" | "lg";
}) => {
  const palette =
    getSpritePaletteFromConfig(table?.captain_sprite_config) ||
    (table?.captain_sprite ? spritePalettes[table.captain_sprite] || getSpritePalette(table.id || table.table_number || 0) : getSpritePalette(table?.id || table?.table_number || 0));
  const scale = size === "lg" ? "h-28 w-20" : size === "sm" ? "h-16 w-12" : "h-24 w-16";
  return (
    <div className={cn("pixel-sprite relative mx-auto", scale, active && "pixel-sprite-active")}>
      <div className="absolute left-[28%] top-[2%] h-[10%] w-[44%]" style={{ backgroundColor: palette.hair }} />
      <div className="absolute left-[20%] top-[10%] h-[16%] w-[60%]" style={{ backgroundColor: palette.hair }} />
      {"longHair" in palette && palette.longHair ? <div className="absolute left-[12%] top-[20%] h-[26%] w-[76%]" style={{ backgroundColor: palette.hair }} /> : null}
      <div className="absolute left-[25%] top-[18%] h-[18%] w-[50%]" style={{ backgroundColor: palette.skin }} />
      <div className="absolute left-[18%] top-[22%] h-[10%] w-[10%]" style={{ backgroundColor: palette.skin }} />
      <div className="absolute right-[18%] top-[22%] h-[10%] w-[10%]" style={{ backgroundColor: palette.skin }} />
      <div className="absolute left-[35%] top-[25%] h-[4%] w-[6%] bg-[#111111]" />
      <div className="absolute right-[35%] top-[25%] h-[4%] w-[6%] bg-[#111111]" />
      <div className="absolute left-[40%] top-[32%] h-[3%] w-[20%] bg-[#d25f5f]" />
      <div className="absolute left-[24%] top-[39%] h-[30%] w-[52%]" style={{ backgroundColor: palette.outfit }} />
      <div className="absolute left-[43%] top-[39%] h-[30%] w-[14%]" style={{ backgroundColor: palette.accent }} />
      <div className="absolute left-[10%] top-[42%] h-[24%] w-[14%]" style={{ backgroundColor: palette.skin }} />
      <div className="absolute right-[10%] top-[42%] h-[24%] w-[14%]" style={{ backgroundColor: palette.skin }} />
      {palette.style === "dress" || palette.style === "skirt" || palette.style === "kimono" ? (
        <>
          <div className="absolute left-[18%] top-[66%] h-[16%] w-[64%]" style={{ backgroundColor: palette.outfit }} />
          <div className="absolute bottom-[3%] left-[30%] h-[18%] w-[12%]" style={{ backgroundColor: palette.legs }} />
          <div className="absolute bottom-[3%] right-[30%] h-[18%] w-[12%]" style={{ backgroundColor: palette.legs }} />
        </>
      ) : (
        <>
          <div className="absolute bottom-[5%] left-[28%] h-[28%] w-[16%]" style={{ backgroundColor: palette.legs }} />
          <div className="absolute bottom-[5%] right-[28%] h-[28%] w-[16%]" style={{ backgroundColor: palette.legs }} />
        </>
      )}
      <div className="absolute bottom-0 left-[25%] h-[5%] w-[22%] bg-[#111111]" />
      <div className="absolute bottom-0 right-[25%] h-[5%] w-[22%] bg-[#111111]" />
    </div>
  );
};

const useIsMobileCaptainDevice = () => {
  const [state, setState] = useState({ ready: false, allowed: false, width: 0 });

  useEffect(() => {
    const evaluate = () => {
      const width = window.innerWidth;
      setState({ ready: true, allowed: true, width });
    };

    evaluate();
    window.addEventListener("resize", evaluate);
    window.addEventListener("orientationchange", evaluate);
    return () => {
      window.removeEventListener("resize", evaluate);
      window.removeEventListener("orientationchange", evaluate);
    };
  }, []);

  return state;
};

const normalizeCaptainsThemeStyle = (value?: string | null): CaptainsThemeStyle =>
  value === "romantic" || value === "modern" || value === "classic" ? value : "pixel";

const CaptainsShell = ({ children, themeStyle = "pixel" }: { children: React.ReactNode; themeStyle?: CaptainsThemeStyle }) => {
  const demoRootPath = `/capitanes/${DEMO_SLUG}`;
  const currentPath = window.location.pathname.replace(/\/$/, "");
  const isDemoPath = currentPath === demoRootPath || currentPath.startsWith(`${demoRootPath}/`);
  const isEmbeddedDemo = new URLSearchParams(window.location.search).get("embed") === "1" || window.self !== window.top;
  const showDemoBanner = isDemoPath && !isEmbeddedDemo;

  return (
  <main className={cn("captains-public min-h-[var(--app-height,100svh)] bg-white text-[#151515]", `captains-theme-${themeStyle}`)}>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Dancing+Script:wght@700&family=Inter:wght@500;700;900&family=Lora:wght@500;700&family=Playfair+Display:wght@700;900&family=Press+Start+2P&family=VT323&display=swap');
      .captains-public h1,
      .captains-public h2,
      .captains-public .pixel-title {
        font-family: var(--captains-heading-font);
        font-weight: var(--captains-heading-weight);
        letter-spacing: 0;
        line-height: 1.25;
        text-shadow: none;
      }
      .captains-public {
        --captains-heading-font: "Press Start 2P", ui-monospace, monospace;
        --captains-body-font: "VT323", ui-monospace, monospace;
        --captains-heading-weight: 400;
        --captains-border-width: 3px;
        --captains-radius: 0;
        --captains-panel-shadow: none;
        --captains-grid-opacity: .06;
        font-family: var(--captains-body-font);
        image-rendering: pixelated;
      }
      .captains-theme-romantic {
        --captains-heading-font: "Dancing Script", "Playfair Display", cursive;
        --captains-body-font: "Lora", Georgia, serif;
        --captains-heading-weight: 700;
        --captains-border-width: 1px;
        --captains-radius: 18px;
        --captains-panel-shadow: 0 18px 48px rgba(47,41,45,.12);
        --captains-grid-opacity: .025;
        image-rendering: auto;
      }
      .captains-theme-modern {
        --captains-heading-font: "Archivo Black", Arial Black, Arial, sans-serif;
        --captains-body-font: "Inter", Arial, sans-serif;
        --captains-heading-weight: 900;
        --captains-border-width: 2px;
        --captains-radius: 8px;
        --captains-panel-shadow: 0 16px 44px rgba(21,21,21,.10);
        --captains-grid-opacity: .035;
        image-rendering: auto;
      }
      .captains-theme-classic {
        --captains-heading-font: "Playfair Display", Georgia, serif;
        --captains-body-font: "Lora", Georgia, serif;
        --captains-heading-weight: 900;
        --captains-border-width: 1px;
        --captains-radius: 10px;
        --captains-panel-shadow: 0 14px 36px rgba(21,21,21,.09);
        --captains-grid-opacity: .03;
        image-rendering: auto;
      }
      .captains-public button,
      .captains-public input,
      .captains-public p,
      .captains-public span {
        letter-spacing: 0;
      }
      .captains-public button,
      .captains-public input {
        font-family: var(--captains-body-font);
      }
      .pixel-panel {
        border: var(--captains-border-width) solid #151515;
        border-radius: var(--captains-radius);
        box-shadow: var(--captains-panel-shadow);
      }
      .pixel-button {
        border: var(--captains-border-width) solid #151515;
        border-radius: var(--captains-radius);
        box-shadow: none;
      }
      .captains-public button.pixel-button {
        transition: filter .16s ease, background-color .16s ease, border-color .16s ease;
      }
      .captains-public button.pixel-button:hover:not(:disabled) {
        filter: brightness(1.04);
      }
      .captains-theme-romantic button {
        text-transform: none;
      }
      .captains-theme-romantic h1,
      .captains-theme-romantic h2,
      .captains-theme-romantic .pixel-title {
        line-height: 1.05;
      }
      .pixel-sprite > div {
        image-rendering: pixelated;
        box-shadow: none;
      }
      .pixel-sprite-active::after {
        content: "";
        position: absolute;
        inset: auto 18% -6% 18%;
        height: 10%;
        background: var(--captains-primary);
        border: var(--captains-border-width) solid #151515;
        border-radius: var(--captains-radius);
      }
      .pixel-map {
        background:
          linear-gradient(90deg, rgba(21,21,21,.08) 1px, transparent 1px),
          linear-gradient(180deg, rgba(21,21,21,.08) 1px, transparent 1px),
          #ffffff;
        background-size: 20px 20px, 20px 20px, 100% 100%;
      }
      .captains-public .pixel-panel .text-white\\/80,
      .captains-public .pixel-panel .text-white\\/75,
      .captains-public .pixel-panel .text-white\\/70,
      .captains-public .pixel-panel .text-white\\/65,
      .captains-public .pixel-panel .text-white\\/60,
      .captains-public .pixel-panel .text-white\\/55,
      .captains-public .pixel-panel .text-white\\/50,
      .captains-public .pixel-panel .text-white\\/45 {
        color: rgba(21,21,21,.72);
      }
      .captains-public .pixel-panel .bg-\\[\\#2f292d\\] .text-white\\/80,
      .captains-public .pixel-panel .bg-\\[\\#2f292d\\] .text-white\\/75,
      .captains-public .pixel-panel .bg-\\[\\#2f292d\\] .text-white\\/70,
      .captains-public .pixel-panel .bg-\\[\\#2f292d\\] .text-white\\/65,
      .captains-public .pixel-panel .bg-\\[\\#2f292d\\] .text-white\\/60 {
        color: rgba(255,255,255,.82);
      }
    `}</style>
    <div
      className="fixed inset-0 bg-cover bg-center opacity-0"
      style={{ backgroundImage: "var(--captains-background-image)", backgroundColor: "#ffffff" }}
    />
    <div className="fixed inset-0 opacity-100 [background-image:linear-gradient(90deg,rgba(21,21,21,var(--captains-grid-opacity))_1px,transparent_1px),linear-gradient(rgba(21,21,21,var(--captains-grid-opacity))_1px,transparent_1px)] [background-size:20px_20px]" />
    {showDemoBanner ? (
      <a
        href="https://revelao.cam/capitanes"
        className="fixed inset-x-0 top-0 z-50 flex min-h-16 items-center justify-center border-b-[3px] border-[#151515] bg-[#f4d35e] px-4 py-3 text-center text-base font-bold leading-5 text-[#151515] underline underline-offset-2 sm:text-lg"
      >
        Esto es una demo. Click aqui para volver a la web de Capitanes
      </a>
    ) : (
      <div className="fixed inset-x-0 top-0 h-2 bg-[var(--captains-primary)]" />
    )}
    <div className={cn(
      "relative mx-auto flex min-h-[var(--app-height,100svh)] w-full max-w-[430px] flex-col px-4 pb-5",
      showDemoBanner ? "pt-24" : "pt-5",
    )}>
      {children}
    </div>
  </main>
  );
};

const GameCard = ({ children, className, ...props }: React.ComponentProps<"section">) => (
  <section
    {...props}
    className={cn(
      "pixel-panel bg-white p-4 text-[#151515]",
      className,
    )}
  >
    {children}
  </section>
);

const GameButton = ({ className, ...props }: React.ComponentProps<typeof Button>) => (
  <Button
    {...props}
    className={cn(
      "pixel-button min-h-14 w-full rounded-none bg-[var(--captains-primary)] px-5 py-4 text-2xl font-bold text-[#151515] hover:bg-[var(--captains-primary)] hover:brightness-105",
      className,
    )}
  />
);

const SecondaryButton = ({ className, ...props }: React.ComponentProps<typeof Button>) => (
  <Button
    {...props}
    variant="outline"
    className={cn(
      "pixel-button min-h-14 w-full rounded-none bg-white px-5 py-4 text-2xl font-bold text-[#151515] hover:bg-neutral-100 hover:text-[#151515]",
      className,
    )}
  />
);

const HeroBadge = ({ children }: { children: React.ReactNode }) => (
  <div className="pixel-button inline-flex items-center gap-2 bg-white px-3 py-2 text-base font-bold uppercase text-[#151515]">
    <Sparkles className="h-3.5 w-3.5" />
    {children}
  </div>
);

const PixelStat = ({ label, value, tone = "primary" }: { label: string; value: React.ReactNode; tone?: "primary" | "secondary" | "gold" }) => (
  <div className={cn("pixel-panel bg-white p-3", tone === "primary" && "border-[var(--captains-primary)]")}>
    <p className="pixel-title text-lg text-[#151515]">{value}</p>
    <p className="mt-1 text-base font-bold uppercase text-[#151515]/65">{label}</p>
  </div>
);

const getCaptainPhotoUrl = (table: CaptainsTable) => {
  if (table.captain_photo_url) return table.captain_photo_url;
  const name = table.captain_name || table.active_captain_name || table.table_name;
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || String(table.table_number || "?");
  const palette = getSpritePaletteFromConfig(table.captain_sprite_config) || getSpritePalette(table.id || table.table_number || 0);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 270">
      <rect width="360" height="270" fill="#ffffff"/>
      <path d="M0 220c70-40 125-45 190-12 62 31 105 24 170-17v79H0z" fill="${palette.outfit}" opacity=".14"/>
      <circle cx="180" cy="112" r="54" fill="${palette.skin}"/>
      <path d="M124 100c14-54 96-68 120-13 4 11 3 22 2 32-24-26-84-24-122 0-2-6-4-12 0-19z" fill="${palette.hair}"/>
      <path d="M96 270c13-70 47-105 84-105s71 35 84 105z" fill="${palette.outfit}"/>
      <rect x="156" y="165" width="48" height="105" fill="${palette.accent}" opacity=".85"/>
      <circle cx="160" cy="112" r="5" fill="#151515"/>
      <circle cx="200" cy="112" r="5" fill="#151515"/>
      <path d="M160 137c13 10 28 10 41 0" stroke="#151515" stroke-width="5" fill="none" stroke-linecap="square"/>
      <rect x="18" y="18" width="324" height="234" fill="none" stroke="#151515" stroke-width="6"/>
      <text x="180" y="245" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#151515">${initials}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const PixelTableMap = ({
  tables,
  selectedTableId,
  onSelect,
}: {
  tables: CaptainsTable[];
  selectedTableId?: string;
  onSelect: (tableId: string) => void;
}) => (
  <div className="pixel-panel pixel-map p-3 text-[#151515]">
    <div className="mb-3 flex items-center justify-between">
      <p className="pixel-title text-xs">MAPA MESAS</p>
      <p className="text-base font-bold uppercase">elige capitán</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {tables.map((table) => {
        const active = selectedTableId === table.id;
        return (
          <button
            key={table.id}
            type="button"
            onClick={() => onSelect(table.id)}
            className={cn(
              "pixel-button relative min-h-[154px] bg-white p-3 text-left transition",
              active && "border-[#151515] bg-[var(--captains-primary)] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]",
            )}
            aria-pressed={active}
          >
            <div className="absolute right-2 top-2 bg-[#151515] px-2 py-1 text-sm font-bold text-white">
              #{table.table_number}
            </div>
            <div className="relative mt-5 flex h-28 items-center justify-center bg-transparent">
              {table.captain_photo_url ? (
                <>
                  <img
                    src={table.captain_photo_url}
                    alt=""
                    loading="lazy"
                    className="aspect-square h-28 w-28 shrink-0 rounded-full border-3 border-[#151515] object-cover"
                  />
                  <div className="absolute -bottom-3 right-2 px-1">
                    <PixelCaptainSprite table={table} active={active} size="sm" />
                  </div>
                </>
              ) : (
                <PixelCaptainSprite table={table} active={active} size="sm" />
              )}
            </div>
            <p className="mt-3 break-words text-xl font-bold leading-tight">{table.table_name}</p>
            <p className="truncate text-base font-bold text-[#151515]/65">
              {table.captain_name || table.active_captain_name || "Sin capitán"}
            </p>
          </button>
        );
      })}
    </div>
  </div>
);

const DesktopBlock = ({ eventUrl }: { eventUrl?: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!eventUrl) return;
    await navigator.clipboard.writeText(eventUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="flex min-h-[var(--app-height,100svh)] items-center justify-center bg-white px-6 text-[#151515]">
      <div className="pixel-panel max-w-md bg-white p-7 text-center">
        <Shield className="mx-auto mb-4 h-11 w-11 text-[#151515]" />
        <h1 className="text-2xl font-black tracking-normal">
          Capitanes by Revelao está pensado para jugar desde el móvil.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#151515]/70">
          Escanea el QR con tu teléfono para empezar la misión con tu mesa.
        </p>
        {eventUrl && (
          <div className="mx-auto mt-5 w-fit rounded-[8px] bg-white p-3">
            <QRCodeSVG value={eventUrl} size={168} />
          </div>
        )}
        <Button onClick={copy} className="mt-5 w-full rounded-[8px]">
          <Copy className="h-4 w-4" />
          {copied ? "Enlace copiado" : "Copiar enlace"}
        </Button>
      </div>
    </main>
  );
};

const LoadingScreen = () => (
  <CaptainsShell>
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#151515]" />
    </div>
  </CaptainsShell>
);

const useVideoPoster = (url: string) => {
  const [poster, setPoster] = useState("");
  useEffect(() => {
    if (!url || url.startsWith("data:image")) {
      setPoster("");
      return;
    }
    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const capture = () => {
      if (cancelled || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 720 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (!cancelled) setPoster(canvas.toDataURL("image/jpeg", 0.78));
      } catch {
        if (!cancelled) setPoster("");
      }
    };
    video.addEventListener("loadeddata", capture, { once: true });
    video.addEventListener("loadedmetadata", () => {
      try { video.currentTime = Math.min(0.1, Math.max(0, video.duration / 2)); } catch { /* Safari can delay seeking. */ }
    }, { once: true });
    video.addEventListener("seeked", capture, { once: true });
    video.src = url;
    video.load();
    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);
  return poster;
};

const SignedEvidenceMedia = ({
  evidence,
  onPhotoOpen,
}: {
  evidence: CaptainsEvidence;
  onPhotoOpen?: (url: string) => void;
}) => {
  const [url, setUrl] = useState("");
  const videoPoster = useVideoPoster(evidence.evidence_type === "video" ? url : "");

  useEffect(() => {
    let active = true;
    if (evidence.file_url.startsWith("blob:") || evidence.file_url.startsWith("data:")) {
      setUrl(evidence.file_url);
      return () => {
        active = false;
      };
    }
    getCaptainsEvidenceSignedUrl(evidence.file_url)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch(() => setUrl(""));
    return () => {
      active = false;
    };
  }, [evidence.file_url]);

  if (!url) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center border-2 border-[#151515] bg-white text-[#151515]/45">
        <EvidenceIcon type={evidence.evidence_type} className="h-10 w-10" />
      </div>
    );
  }

  if (evidence.evidence_type === "photo") {
    return (
      <button type="button" className="block w-full" onClick={() => onPhotoOpen?.(url)}>
        <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[8px] object-cover" />
      </button>
    );
  }

  if (evidence.evidence_type === "video") {
    if (url.startsWith("data:image")) {
      return <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-[8px] object-cover" />;
    }
    return <video src={url} poster={videoPoster || undefined} controls playsInline preload="auto" className="aspect-[4/3] w-full rounded-[8px] bg-black object-cover" />;
  }

  return null;
};

const SummaryFullScreenEvidence = ({ evidence }: { evidence?: CaptainsEvidence }) => {
  const [url, setUrl] = useState("");
  const videoPoster = useVideoPoster(evidence?.evidence_type === "video" ? url : "");

  useEffect(() => {
    let active = true;
    if (!evidence?.file_url) {
      setUrl("");
      return () => {
        active = false;
      };
    }
    if (evidence.file_url.startsWith("blob:") || evidence.file_url.startsWith("data:")) {
      setUrl(evidence.file_url);
      return () => {
        active = false;
      };
    }
    getCaptainsEvidenceSignedUrl(evidence.file_url)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch(() => setUrl(""));
    return () => {
      active = false;
    };
  }, [evidence?.file_url]);

  if (!evidence || !url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white text-[#151515]/40">
        <ImageIcon className="h-14 w-14" />
      </div>
    );
  }

  if (evidence.evidence_type === "video" && !url.startsWith("data:image")) {
    return <video src={url} poster={videoPoster || undefined} controls playsInline preload="auto" className="absolute inset-0 h-full w-full bg-black object-cover" />;
  }

  return <img src={url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />;
};

export default function CaptainsPublic() {
  const { eventSlug = "" } = useParams();
  const navigate = useNavigate();
  const step = getPublicStep(window.location.pathname);
  const mobile = useIsMobileCaptainDevice();
  const isDemo = eventSlug === DEMO_SLUG;
  const eventQuery = useCaptainsEventDetail(eventSlug);
  const refetchEvent = eventQuery.refetch;
  const detail = isDemo
    ? eventQuery.data
      ? {
          event: eventQuery.data.event,
          tables: eventQuery.data.tables.length ? eventQuery.data.tables : demoEventDetail.tables,
          challenges: eventQuery.data.challenges.length ? eventQuery.data.challenges : demoEventDetail.challenges,
        }
      : demoEventDetail
    : eventQuery.data;
  const event = detail?.event;
  const eventEnded = Boolean(
    event && (
      event.status === "finished" ||
      (event.end_time && new Date(event.end_time).getTime() <= Date.now())
    ),
  );
  const themeStyle = normalizeCaptainsThemeStyle(event?.theme_style);
  const tables = useMemo(() => detail?.tables || [], [detail?.tables]);
  const challenges = useMemo(() => detail?.challenges || [], [detail?.challenges]);
  const [session, setSession] = useState<CaptainSession | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [captainNameInput, setCaptainNameInput] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tableChallenges, setTableChallenges] = useState<CaptainsTableChallenge[]>([]);
  const [ranking, setRanking] = useState<CaptainsRankingItem[]>([]);
  const [phase, setPhase] = useState<ChallengePhase>("intro");
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [resultEvidence, setResultEvidence] = useState<CaptainsEvidence | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState("");
  const [evidenceVideoPoster, setEvidenceVideoPoster] = useState("");
  const [selectedQuestionOption, setSelectedQuestionOption] = useState("");
  const [lastCorrectAnswer, setLastCorrectAnswer] = useState("");
  const [lastResultType, setLastResultType] = useState<CaptainsEvidenceType | null>(null);
  const [lastResultPoints, setLastResultPoints] = useState(0);
  const [liveEvidence, setLiveEvidence] = useState<CaptainsEvidence[]>([]);
  const [liveRows, setLiveRows] = useState<CaptainsTableChallenge[]>([]);
  const [liveFilter, setLiveFilter] = useState<EvidenceFilter>("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [newMemoriesAvailable, setNewMemoriesAvailable] = useState(false);
  const [visibleMemoriesLimit, setVisibleMemoriesLimit] = useState(20);
  const [photoModalUrl, setPhotoModalUrl] = useState("");
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("tables");
  const [summarySelectedTableId, setSummarySelectedTableId] = useState("");
  const [summarySelectedChallengeId, setSummarySelectedChallengeId] = useState("");
  const [summaryEvidenceIndex, setSummaryEvidenceIndex] = useState(0);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const expiringChallengeRef = useRef("");

  useEffect(() => {
    if (!isDemo || step !== "home" || !eventSlug) return;
    resetDemoGameStorage(eventSlug);
    setSession(null);
    setSelectedTableId("");
    setCaptainNameInput("");
    setTableChallenges([]);
    setRanking([]);
    setPhase("intro");
    setEvidenceFile(null);
    setEvidencePreview("");
    setSelectedQuestionOption("");
    setLiveEvidence([]);
    setLiveRows([]);
  }, [eventSlug, isDemo, step]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--captains-primary",
      isThemeColor(event?.primary_color) ? event?.primary_color || DEFAULT_CAPTAINS_PRIMARY : DEFAULT_CAPTAINS_PRIMARY,
    );
    root.style.setProperty(
      "--captains-secondary",
      isThemeColor(event?.secondary_color) ? event?.secondary_color || DEFAULT_CAPTAINS_SECONDARY : DEFAULT_CAPTAINS_SECONDARY,
    );
    root.style.setProperty("--captains-background-image", cssUrl(event?.background_image_url));

    return () => {
      root.style.removeProperty("--captains-primary");
      root.style.removeProperty("--captains-secondary");
      root.style.removeProperty("--captains-background-image");
    };
  }, [event?.background_image_url, event?.primary_color, event?.secondary_color]);

  useEffect(() => {
    if (!eventSlug) return;
    if (isDemo && step === "home") return;
    const raw = localStorage.getItem(sessionKey(eventSlug));
    if (!raw) return;
    try {
      setSession(JSON.parse(raw) as CaptainSession);
    } catch {
      localStorage.removeItem(sessionKey(eventSlug));
    }
  }, [eventSlug, isDemo, step]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, tables],
  );

  useEffect(() => {
    if (step !== "start" || isDemo || !session?.table_id || selectedTableId) return;
    if (tables.some((table) => table.id === session.table_id)) setSelectedTableId(session.table_id);
  }, [isDemo, selectedTableId, session?.table_id, step, tables]);
  const currentTable = useMemo(
    () => tables.find((table) => table.id === session?.table_id) || null,
    [session?.table_id, tables],
  );

  const challengeById = useMemo(() => {
    const map = new Map<string, CaptainsEventChallenge>();
    challenges.forEach((challenge) => map.set(challenge.id, challenge));
    return map;
  }, [challenges]);
  const tableById = useMemo(() => new Map(tables.map((table) => [table.id, table])), [tables]);

  const currentRow = useMemo(() => {
    const active = tableChallenges.find((row) => ["ready", "in_progress"].includes(row.status));
    if (active) return active;
    const pending = tableChallenges.find((row) => !terminalStatuses.has(row.status));
    if (pending) return pending;
    // Once the final challenge becomes terminal there is no active row anymore.
    // Keep the most recently finished one while its result screen is visible so
    // the UI does not fall through to the "Preparando misiones" loading state.
    if (phase === "result" || phase === "expired") {
      return [...tableChallenges]
        .filter((row) => terminalStatuses.has(row.status))
        .sort((a, b) => {
          const aTime = new Date(a.updated_at || a.reviewed_at || a.submitted_at || 0).getTime();
          const bTime = new Date(b.updated_at || b.reviewed_at || b.submitted_at || 0).getTime();
          return bTime - aTime;
        })[0] || null;
    }
    return null;
  }, [phase, tableChallenges]);

  const currentChallenge = currentRow ? challengeById.get(currentRow.challenge_id) || null : null;
  const getCurrentRemaining = () => {
    if (!currentChallenge?.has_time_limit) return remaining;
    const total = currentChallenge.time_limit_seconds || 0;
    const startedAt = currentRow?.started_at ? new Date(currentRow.started_at).getTime() : Date.now();
    return Math.max(0, total - Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
  };
  const completedRows = tableChallenges.filter((row) => terminalStatuses.has(row.status));
  const allDone = tableChallenges.length > 0 && completedRows.length === tableChallenges.length;
  const hasStartedGame = tableChallenges.some((row) => row.status !== "pending" && row.status !== "ready");
  const currentIndex = currentRow?.randomized_order_index || Math.min(completedRows.length + 1, Math.max(tableChallenges.length, 1));
  const myRank = ranking.find((item) => item.id === session?.table_id) || null;
  const totalPoints = myRank?.total_points ?? currentTable?.total_points ?? 0;
  const failedCount = tableChallenges.filter((row) => ["failed", "time_expired", "rejected"].includes(row.status)).length;

  const publicUrl =
    isDemo && eventSlug
      ? getCaptainsPublicUrl(eventSlug)
      : eventSlug
        ? normalizeCaptainsPublicUrl(event?.public_url, eventSlug)
        : "";

  const getDemoRows = (tableId: string) => {
    const key = demoRowsKey(eventSlug, tableId);
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as CaptainsTableChallenge[];

    const rows = shuffleCaptainsItems(challenges).map((challenge, index) => ({
      id: `demo-row-${tableId}-${challenge.id}`,
      event_id: demoEventDetail.event.id,
      table_id: tableId,
      challenge_id: challenge.id,
      randomized_order_index: index + 1,
      status: index === 0 ? "ready" : "pending",
      points_awarded: 0,
      started_at: null,
      submitted_at: null,
      elapsed_seconds: null,
      remaining_seconds: null,
      is_time_expired: false,
      automatic_score_calculated: false,
      reviewed_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    })) as CaptainsTableChallenge[];
    localStorage.setItem(key, JSON.stringify(rows));
    return rows;
  };

  const saveDemoRows = (tableId: string, rows: CaptainsTableChallenge[]) => {
    localStorage.setItem(demoRowsKey(eventSlug, tableId), JSON.stringify(rows));
    setTableChallenges(rows);
    return rows;
  };

  const getDemoEvidence = () => {
    const stored = localStorage.getItem(demoEvidenceKey(eventSlug));
    return stored ? (JSON.parse(stored) as CaptainsEvidence[]) : demoSummaryEvidence();
  };

  const saveDemoEvidence = (rows: CaptainsEvidence[]) => {
    localStorage.setItem(demoEvidenceKey(eventSlug), JSON.stringify(rows));
    setLiveEvidence(rows);
  };

  const getDemoRanking = (activeTableId?: string, rowsForActiveTable?: CaptainsTableChallenge[]) => {
    const items = tables.map((table) => {
      const rows = table.id === activeTableId && rowsForActiveTable ? rowsForActiveTable : [];
      const dynamicPoints = rows.reduce((sum, row) => sum + (row.points_awarded || 0), 0);
      const dynamicCompleted = rows.filter((row) => ["completed", "pending_review"].includes(row.status)).length;
      const dynamicFailed = rows.filter((row) => ["failed", "time_expired", "rejected"].includes(row.status)).length;
      return {
        ...table,
        total_points: table.id === activeTableId ? dynamicPoints : table.total_points,
        completed_challenges: table.id === activeTableId ? dynamicCompleted : table.completed_challenges,
        failed_challenges: table.id === activeTableId ? dynamicFailed : table.failed_challenges,
        active_captain_name: table.id === activeTableId ? session?.captain_name || table.active_captain_name : table.active_captain_name,
      };
    });

    return items
      .sort((a, b) => b.total_points - a.total_points || b.completed_challenges - a.completed_challenges)
      .map((table, index) => ({ ...table, rank: index + 1 })) as CaptainsRankingItem[];
  };

  const refreshGame = async () => {
    if (!event || !session) return;
    if (isDemo) {
      const rows = getDemoRows(session.table_id);
      setTableChallenges(rows);
      setRanking(getDemoRanking(session.table_id, rows));
      return;
    }
    const [rows, rank] = await Promise.all([
      generateRandomChallengeOrderForTable(event.id, session.table_id),
      getCaptainsRanking(event.id),
      refetchEvent(),
    ]);
    setTableChallenges(rows);
    setRanking(rank);
  };

  useEffect(() => {
    if (!event || !session || !["play", "ranking", "final", "live", "resumen"].includes(step)) return;
    refreshGame();
  }, [event?.id, session?.table_id, step]);

  useEffect(() => {
    if (!event || !eventEnded) return;
    getCaptainsRanking(event.id).then(setRanking).catch(() => setRanking([]));
    if (!["ranking", "resumen"].includes(step)) go("ranking");
  }, [event?.id, eventEnded, step]);

  useEffect(() => {
    if (step !== "play" || !currentRow) return;
    if (currentRow.status === "in_progress") {
      setPhase("progress");
      return;
    }
    if (phase === "result" || phase === "expired") return;
    setEvidenceFile(null);
    setSelectedQuestionOption("");
    setLastCorrectAnswer("");
    setLastResultType(null);
    setLastResultPoints(0);
    if (!hasStartedGame) {
      setPhase("intro");
      return;
    }
    setPhase("preview");
  }, [currentRow?.id, currentRow?.status, hasStartedGame, step]);

  useEffect(() => {
    if (step !== "play" || phase !== "progress" || !currentRow || !currentChallenge?.has_time_limit) return;
    const total = currentChallenge.time_limit_seconds || 0;
    const tick = async () => {
      const started = currentRow.started_at ? new Date(currentRow.started_at).getTime() : Date.now();
      const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
      const next = Math.max(0, total - elapsed);
      setRemaining(next);
      if (next <= 0) {
        if (expiringChallengeRef.current === currentRow.id) return;
        expiringChallengeRef.current = currentRow.id;
        setPhase("expired");
        setLastResultType(currentChallenge.evidence_type);
        setLastResultPoints(0);
        setResultKind("expired");
        if (isDemo && session) {
          const expiredRow = {
            ...currentRow,
            status: "time_expired" as const,
            points_awarded: 0,
            remaining_seconds: 0,
            is_time_expired: true,
            reviewed_at: nowIso(),
            updated_at: nowIso(),
          };
          const nextRows = tableChallenges.map((item) => (item.id === expiredRow.id ? expiredRow : item));
          const nextPending = nextRows.find((item) => item.status === "pending");
          const readyRows = nextPending
            ? nextRows.map((item) => (item.id === nextPending.id ? { ...item, status: "ready" as const } : item))
            : nextRows;
          saveDemoRows(session.table_id, readyRows);
          setRanking(getDemoRanking(session.table_id, readyRows));
          return;
        }
        try {
          await expireCaptainsTableChallenge(currentRow.id);
          await refreshGame();
        } catch (error) {
          // A temporary network failure must not leave the challenge frozen in
          // the expired UI. Release the guard so the next tick can reconcile it.
          console.error("Error expiring captains challenge:", error);
          expiringChallengeRef.current = "";
          setPhase("progress");
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    const syncAfterCamera = () => {
      if (document.visibilityState === "visible") void tick();
    };
    window.addEventListener("focus", syncAfterCamera);
    document.addEventListener("visibilitychange", syncAfterCamera);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", syncAfterCamera);
      document.removeEventListener("visibilitychange", syncAfterCamera);
    };
  }, [step, phase, currentRow?.id, currentRow?.started_at, currentChallenge?.id]);

  useEffect(() => {
    expiringChallengeRef.current = "";
  }, [currentRow?.id]);

  useEffect(() => {
    if (!evidenceFile) {
      setEvidencePreview("");
      setEvidenceVideoPoster("");
      return;
    }
    const url = URL.createObjectURL(evidenceFile);
    setEvidencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [evidenceFile]);

  useEffect(() => {
    if (!evidencePreview || !evidenceFile?.type.startsWith("video/")) {
      setEvidenceVideoPoster("");
      return;
    }
    let cancelled = false;
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const captureFrame = () => {
      if (cancelled || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement("canvas");
      const maxWidth = 720;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        setEvidenceVideoPoster(canvas.toDataURL("image/jpeg", 0.78));
      } catch {
        setEvidenceVideoPoster("");
      }
    };
    video.addEventListener("loadeddata", captureFrame, { once: true });
    video.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(video.duration) && video.duration > 0.15) {
        try { video.currentTime = Math.min(0.1, video.duration / 2); } catch { /* Safari may reject seeking before data is ready. */ }
      }
    }, { once: true });
    video.addEventListener("seeked", captureFrame, { once: true });
    video.src = evidencePreview;
    video.load();
    return () => {
      cancelled = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [evidenceFile, evidencePreview]);

  const go = (next: PublicStep) => {
    const suffix = next === "home" ? "" : `/${next}`;
    navigate(`/capitanes/${eventSlug}${suffix}`);
  };

  const needsWait = event?.start_time && new Date(event.start_time).getTime() > Date.now();
  const minutesLeft = event?.start_time
    ? Math.max(0, Math.ceil((new Date(event.start_time).getTime() - Date.now()) / 60000))
    : 0;

  const handleTableSelect = (tableId: string) => {
    setSelectionError("");
    setSelectedTableId(tableId);
    const table = tables.find((item) => item.id === tableId);
    setCaptainNameInput(table?.captain_name || "");
  };

  const enterGame = async () => {
    if (!event || !selectedTable) return;
    const cleanName = (
      captainNameInput ||
      selectedTable.captain_name ||
      selectedTable.active_captain_name ||
      `Capitán ${selectedTable.table_name}`
    ).trim();
    setBusy(true);
    setSelectionError("");
    try {
      if (isDemo) {
        const nextSession: CaptainSession = {
          table_id: selectedTable.id,
          table_name: selectedTable.table_name,
          captain_name: cleanName,
          session_token: selectedTable.session_token,
          selected_at: nowIso(),
          user_agent: navigator.userAgent,
          device_info: {
            width: window.innerWidth,
            height: window.innerHeight,
            platform: navigator.platform,
          },
        };
        localStorage.setItem(sessionKey(eventSlug), JSON.stringify(nextSession));
        setSession(nextSession);
        const rows = getDemoRows(selectedTable.id);
        setTableChallenges(rows);
        setRanking(getDemoRanking(selectedTable.id, rows));
        go("play");
        return;
      }

      const access = await selectCaptainsTableSession(selectedTable.id, cleanName);
      const nextSession: CaptainSession = {
        table_id: access.table.id,
        table_name: access.table.table_name,
        captain_name: cleanName,
        session_token: access.table.session_token,
        selected_at: access.selected_at,
        user_agent: access.user_agent,
        device_info: access.device_info,
      };
      localStorage.setItem(sessionKey(eventSlug), JSON.stringify(nextSession));
      setSession(nextSession);
      await generateRandomChallengeOrderForTable(event.id, selectedTable.id);
      go("play");
    } catch (error) {
      console.error("Error entering captains game:", error);
      setSelectionError("No hemos podido entrar al juego. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

    const startCurrentChallenge = async () => {
      if (!currentRow) return;
      setBusy(true);
      setLastCorrectAnswer("");
      setLastResultType(null);
      setLastResultPoints(0);
    try {
      if (isDemo && session) {
        const row = {
          ...currentRow,
          status: "in_progress" as const,
          started_at: nowIso(),
          is_time_expired: false,
          updated_at: nowIso(),
        };
        const rows = saveDemoRows(
          session.table_id,
          tableChallenges.map((item) => (item.id === row.id ? row : item)),
        );
        setRanking(getDemoRanking(session.table_id, rows));
        setRemaining(currentChallenge?.time_limit_seconds || 0);
        setPhase("progress");
        return;
      }

      const row = await startCaptainsTableChallenge(currentRow.id);
      setTableChallenges((rows) => rows.map((item) => (item.id === row.id ? row : item)));
      setRemaining(currentChallenge?.time_limit_seconds || 0);
      setPhase("progress");
    } finally {
      setBusy(false);
    }
  };

  const onPickEvidence = (event: ChangeEvent<HTMLInputElement>) => {
    setEvidenceFile(event.target.files?.[0] || null);
  };

  const openEvidenceCapture = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  };

  const submitEvidence = async () => {
    if (!event || !session || !currentRow || !currentChallenge || !evidenceFile) return;
    if (currentChallenge.evidence_type === "question") return;
    const liveRemaining = getCurrentRemaining();
    setRemaining(liveRemaining);
    if (currentChallenge.has_time_limit && liveRemaining <= 0) return;
    setBusy(true);
    try {
      const total = currentChallenge.time_limit_seconds || null;
      const elapsed = currentChallenge.has_time_limit && total ? Math.max(0, total - liveRemaining) : null;
      if (isDemo) {
        const pointsAwarded = calculateCaptainsAutomaticScore({
          maxPoints: currentChallenge.points,
          hasTimeLimit: currentChallenge.has_time_limit,
          totalSeconds: total,
          remainingSeconds: currentChallenge.has_time_limit ? liveRemaining : null,
          succeeded: true,
        });
        const fileUrl = URL.createObjectURL(evidenceFile);
        const evidence: CaptainsEvidence = {
          id: `demo-evidence-${crypto.randomUUID()}`,
          event_id: event.id,
          table_id: session.table_id,
          table_challenge_id: currentRow.id,
          captain_name: session.captain_name,
          evidence_type: currentChallenge.evidence_type,
          file_url: fileUrl,
          thumbnail_url: null,
          status: "approved",
          points_awarded: pointsAwarded,
          admin_comment: null,
          elapsed_seconds: elapsed,
          remaining_seconds: currentChallenge.has_time_limit ? liveRemaining : null,
          created_at: nowIso(),
          reviewed_at: nowIso(),
          deleted_at: null,
        };
        const completedRow = {
          ...currentRow,
          status: "completed" as const,
          points_awarded: pointsAwarded,
          submitted_at: nowIso(),
          elapsed_seconds: elapsed,
          remaining_seconds: currentChallenge.has_time_limit ? liveRemaining : null,
          reviewed_at: nowIso(),
          automatic_score_calculated: true,
          updated_at: nowIso(),
        };
        const nextRows = tableChallenges.map((item) => (item.id === completedRow.id ? completedRow : item));
        const nextPending = nextRows.find((item) => item.status === "pending");
        const readyRows = nextPending
          ? nextRows.map((item) => (item.id === nextPending.id ? { ...item, status: "ready" as const } : item))
          : nextRows;
        saveDemoRows(session.table_id, readyRows);
        setRanking(getDemoRanking(session.table_id, readyRows));
          saveDemoEvidence([evidence, ...getDemoEvidence()]);
          setResultEvidence(evidence);
          setLastResultType(currentChallenge.evidence_type);
          setLastResultPoints(pointsAwarded);
          setResultKind("success");
        setPhase("result");
        setEvidenceFile(null);
        return;
      }

      const evidence = await uploadCaptainsEvidence({
        eventId: event.id,
        tableId: session.table_id,
        tableChallengeId: currentRow.id,
        captainName: session.captain_name,
        evidenceType: currentChallenge.evidence_type as "photo" | "video",
        file: evidenceFile,
        elapsedSeconds: elapsed,
        remainingSeconds: currentChallenge.has_time_limit ? liveRemaining : null,
        scoringMode: event.scoring_mode,
      });
        setResultEvidence(evidence);
        setLastResultType(currentChallenge.evidence_type);
        setLastResultPoints(evidence.points_awarded || 0);
        setResultKind(event.scoring_mode === "manual" ? "manual" : "success");
      setPhase("result");
      setEvidenceFile(null);
      await refreshGame();
    } finally {
      setBusy(false);
    }
  };

    const submitQuestion = async () => {
      if (!event || !session || !currentRow || !currentChallenge || currentChallenge.evidence_type !== "question" || !selectedQuestionOption) return;
      const liveRemaining = getCurrentRemaining();
      setRemaining(liveRemaining);
      if (currentChallenge.has_time_limit && liveRemaining <= 0) return;
      setBusy(true);
      try {
        const total = currentChallenge.time_limit_seconds || null;
        const elapsed = currentChallenge.has_time_limit && total ? Math.max(0, total - liveRemaining) : null;
        const correct = selectedQuestionOption === currentChallenge.question_correct_option;
        setLastCorrectAnswer(currentChallenge.question_correct_option || "");
      const pointsAwarded = correct
        ? calculateCaptainsAutomaticScore({
            maxPoints: currentChallenge.points,
            hasTimeLimit: currentChallenge.has_time_limit,
            totalSeconds: total,
            remainingSeconds: currentChallenge.has_time_limit ? liveRemaining : null,
            succeeded: true,
          })
        : 0;

      if (isDemo) {
        const completedRow = {
          ...currentRow,
          status: correct ? "completed" as const : "failed" as const,
          points_awarded: pointsAwarded,
          submitted_at: nowIso(),
          elapsed_seconds: elapsed,
          remaining_seconds: currentChallenge.has_time_limit ? liveRemaining : null,
          question_answer: selectedQuestionOption,
          reviewed_at: nowIso(),
          automatic_score_calculated: true,
          updated_at: nowIso(),
        };
        const nextRows = tableChallenges.map((item) => (item.id === completedRow.id ? completedRow : item));
        const nextPending = nextRows.find((item) => item.status === "pending");
        const readyRows = nextPending
          ? nextRows.map((item) => (item.id === nextPending.id ? { ...item, status: "ready" as const } : item))
          : nextRows;
        saveDemoRows(session.table_id, readyRows);
          setRanking(getDemoRanking(session.table_id, readyRows));
          setResultEvidence(null);
          setLastResultType("question");
          setLastResultPoints(pointsAwarded);
          setResultKind(correct ? "success" : "failed");
        setPhase("result");
        return;
      }

        const result = await completeCaptainsQuestionChallenge({
        eventId: event.id,
        tableId: session.table_id,
        tableChallengeId: currentRow.id,
        answer: selectedQuestionOption,
        elapsedSeconds: elapsed,
        remainingSeconds: currentChallenge.has_time_limit ? liveRemaining : null,
        });
        setResultEvidence(null);
        setLastResultType("question");
        setLastResultPoints(pointsAwarded);
        setResultKind(result.correct ? "success" : "failed");
      setPhase("result");
      await refreshGame();
    } finally {
      setBusy(false);
    }
  };

  const failChallenge = async () => {
    if (!currentRow) return;
    setBusy(true);
    try {
      if (isDemo && session) {
        const failedRow = {
          ...currentRow,
          status: "failed" as const,
          points_awarded: 0,
          reviewed_at: nowIso(),
          updated_at: nowIso(),
        };
        const nextRows = tableChallenges.map((item) => (item.id === failedRow.id ? failedRow : item));
        const nextPending = nextRows.find((item) => item.status === "pending");
        const readyRows = nextPending
          ? nextRows.map((item) => (item.id === nextPending.id ? { ...item, status: "ready" as const } : item))
          : nextRows;
          saveDemoRows(session.table_id, readyRows);
          setRanking(getDemoRanking(session.table_id, readyRows));
          setLastResultType(currentChallenge?.evidence_type || null);
          setLastResultPoints(0);
          setResultKind("failed");
        setPhase("result");
        return;
      }

        await failCaptainsTableChallenge(currentRow.id);
        setLastResultType(currentChallenge?.evidence_type || null);
        setLastResultPoints(0);
        setResultKind("failed");
      setPhase("result");
      await refreshGame();
    } finally {
      setBusy(false);
    }
  };

  const nextAfterRanking = () => {
    if (allDone) {
      go("final");
      return;
    }
    setPhase("preview");
    go("play");
  };

  const openTableSummary = (tableId: string) => {
    setSummaryMode("tables");
    setSummarySelectedTableId(tableId);
    setSummaryEvidenceIndex(0);
    go("resumen");
  };

  const openPhotoEvidence = async (evidence: CaptainsEvidence) => {
    if (evidence.file_url.startsWith("blob:") || evidence.file_url.startsWith("data:")) {
      setPhotoModalUrl(evidence.file_url);
      return;
    }
    try {
      setPhotoModalUrl(await getCaptainsEvidenceSignedUrl(evidence.file_url));
    } catch {
      setLiveError("No hemos podido abrir este recuerdo. Inténtalo de nuevo.");
    }
  };

  const shareSummary = async () => {
    const url = `${getCaptainsPublicUrl(eventSlug)}/resumen`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Resumen ${event?.name || "Capitanes by Revelao"}`,
          text: "Mira el resumen de la misión.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setSummaryCopied(true);
        setTimeout(() => setSummaryCopied(false), 1800);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setSummaryCopied(true);
      setTimeout(() => setSummaryCopied(false), 1800);
    }
  };

  const refreshLive = async () => {
    if (!event) return;
    setIsRefreshingLive(true);
    setLiveError("");
    try {
      if (isDemo) {
        const rows = getDemoEvidence().filter((row) => row.file_url && !["deleted", "rejected"].includes(row.status));
        setLiveEvidence((prev) => {
          if (prev[0]?.id && rows[0]?.id && prev[0].id !== rows[0].id) setNewMemoriesAvailable(true);
          return rows;
        });
        setLiveRows([...(session ? getDemoRows(session.table_id) : []), ...demoSampleRows()]);
        setLastRefresh(new Date());
        return;
      }

      const [evidenceRows, challengeRows] = await Promise.all([
        getCaptainsEvidence(event.id),
        getCaptainsTableChallenges(event.id),
      ]);
      const visibleRows = evidenceRows.filter((row) => row.file_url && !["deleted", "rejected"].includes(row.status));
      setLiveEvidence((prev) => {
        if (prev[0]?.id && visibleRows[0]?.id && prev[0].id !== visibleRows[0].id) setNewMemoriesAvailable(true);
        return visibleRows;
      });
      setLiveRows(challengeRows);
      setLastRefresh(new Date());
    } catch {
      setLiveError("No hemos podido cargar los recuerdos. Inténtalo de nuevo.");
    } finally {
      setIsRefreshingLive(false);
    }
  };

  useEffect(() => {
    if (!["live", "resumen"].includes(step) || !event) return;
    refreshLive();
    const id = window.setInterval(refreshLive, 8000);
    return () => window.clearInterval(id);
  }, [step, event?.id]);

  useEffect(() => {
    setVisibleMemoriesLimit(20);
    setNewMemoriesAvailable(false);
  }, [liveFilter]);

  const filteredEvidence = liveEvidence.filter((evidence) => {
    if (liveFilter === "mine") return evidence.table_id === session?.table_id;
    if (liveFilter === "others") return evidence.table_id !== session?.table_id;
    if (["photo", "video"].includes(liveFilter)) return evidence.evidence_type === liveFilter;
    return true;
  });
  const visibleLiveEvidence = filteredEvidence.slice(0, visibleMemoriesLimit);
  const summarySourceEvidence = isDemo && liveEvidence.length === 0 ? demoSummaryEvidence() : liveEvidence;
  const summaryRows = isDemo && liveRows.length === 0 ? demoSampleRows() : liveRows;
  const summaryEvidence = summarySourceEvidence.filter((evidence) => evidence.file_url);
  const summaryRowById = new Map(summaryRows.map((row) => [row.id, row]));
  const summaryEvidenceWithMeta = summaryEvidence
    .map((evidence) => {
      const row = summaryRowById.get(evidence.table_challenge_id);
      const challenge = row ? challengeById.get(row.challenge_id) : undefined;
      const table = tableById.get(evidence.table_id);
      return { evidence, row, challenge, table };
    })
    .filter((item) => item.table && item.row && item.challenge);
  const summaryVisualChallenges = useMemo(
    () => challenges.filter((challenge) => ["photo", "video"].includes(challenge.evidence_type)),
    [challenges],
  );
  const summarySelectedTable = tableById.get(summarySelectedTableId);
  const summarySelectedChallenge = challengeById.get(summarySelectedChallengeId);
  const summaryTableItems = summarySelectedTable
    ? summaryVisualChallenges.map((challenge) => {
        const evidenceItem = summaryEvidenceWithMeta.find(
          (item) => item.evidence.table_id === summarySelectedTable.id && item.row?.challenge_id === challenge.id,
        );
        const row = summaryRows.find((candidate) => candidate.table_id === summarySelectedTable.id && candidate.challenge_id === challenge.id);
        return evidenceItem || { evidence: undefined, row, challenge, table: summarySelectedTable };
      })
    : [];
  const summaryChallengeItems = summarySelectedChallenge
    ? tables.map((table) => {
        const evidenceItem = summaryEvidenceWithMeta.find(
          (item) => item.evidence.table_id === table.id && item.row?.challenge_id === summarySelectedChallenge.id,
        );
        const row = summaryRows.find((candidate) => candidate.table_id === table.id && candidate.challenge_id === summarySelectedChallenge.id);
        return evidenceItem || { evidence: undefined, row, challenge: summarySelectedChallenge, table };
      })
    : [];
  const activeSummaryItems = summaryMode === "tables" ? summaryTableItems : summaryChallengeItems;
  const activeSummaryItem = activeSummaryItems[Math.min(summaryEvidenceIndex, Math.max(activeSummaryItems.length - 1, 0))];

  useEffect(() => {
    if (step !== "resumen") return;
    const firstTableId = [...tables].sort((a, b) => a.table_number - b.table_number)[0]?.id || "";
    setSummaryMode("tables");
    setSummarySelectedTableId((currentTableId) =>
      tables.some((table) => table.id === currentTableId) ? currentTableId : firstTableId,
    );
    setSummaryEvidenceIndex(0);
  }, [event?.id, step]);

  useEffect(() => {
    if (step !== "resumen") return;
    const preferredChallengeId = summaryVisualChallenges[0]?.id || "";
    if (!summarySelectedChallengeId || !summaryVisualChallenges.some((challenge) => challenge.id === summarySelectedChallengeId)) {
      setSummarySelectedChallengeId(preferredChallengeId);
    }
  }, [step, summarySelectedChallengeId, summaryVisualChallenges]);

  useEffect(() => {
    setSummaryEvidenceIndex(0);
  }, [summaryMode, summarySelectedTableId, summarySelectedChallengeId]);

  useEffect(() => {
    if (summaryEvidenceIndex >= activeSummaryItems.length) {
      setSummaryEvidenceIndex(Math.max(activeSummaryItems.length - 1, 0));
    }
  }, [activeSummaryItems.length, summaryEvidenceIndex]);

  if ((!isDemo && eventQuery.isLoading) || !mobile.ready) return <LoadingScreen />;
  if (!event || !detail) {
    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex flex-1 items-center justify-center text-center">
          <GameCard>
            <XCircle className="mx-auto mb-3 h-10 w-10 text-[#151515]" />
            <h1 className="text-xl font-black">Misión no encontrada</h1>
            <p className="mt-2 text-sm text-[#151515]/70">Comprueba el QR o pide un nuevo enlace al equipo.</p>
          </GameCard>
        </div>
      </CaptainsShell>
    );
  }
  if (!mobile.allowed) return <DesktopBlock eventUrl={publicUrl} />;
  if (eventEnded && !["ranking", "resumen"].includes(step)) return <LoadingScreen />;

  if (step === "home") {
    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex flex-1 flex-col justify-between gap-5">
          <div className="flex flex-1 items-center">
            <GameCard>
              <p className="whitespace-pre-line text-3xl leading-8 text-[#151515]">
                {event.description || "Bienvenidos a Capitanes. Reúne a tu mesa, cread recuerdos y superad pequeños retos durante la celebración."}
              </p>
            </GameCard>
          </div>
          <GameButton onClick={() => go("start")}>
            ¡Empecemos! <ChevronRight className="h-5 w-5" />
          </GameButton>
        </div>
      </CaptainsShell>
    );
  }

  if (step === "start") {
    const canEnter = Boolean(selectedTable);
    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex min-h-[calc(var(--app-height,100svh)-40px)] flex-col gap-4 pb-5">
          <div className="pt-3">
            <h1 className="mt-4 text-3xl">Elige tu mesa</h1>
            <p className="mt-2 text-2xl leading-7 text-[#151515]/70">Selecciona tu mesa y capitán para entrar al juego.</p>
          </div>
          <div className="flex-1">
            <PixelTableMap
              tables={tables}
              selectedTableId={selectedTableId}
              onSelect={handleTableSelect}
            />
          </div>
          {selectionError && (
            <div role="alert" className="pixel-panel border-[#151515] bg-white p-3 text-base font-bold text-[#151515]">
              {selectionError}
            </div>
          )}
          <GameButton disabled={!canEnter || busy} onClick={enterGame}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
            Entrar al juego
          </GameButton>
        </div>
      </CaptainsShell>
    );
  }

  if (!session && !eventEnded) {
    go("start");
    return <LoadingScreen />;
  }

  if (step === "play") {
    if (needsWait) {
      return (
        <CaptainsShell themeStyle={themeStyle}>
          <div className="flex flex-1 flex-col justify-center gap-4">
            <GameCard className="text-center">
              <Clock3 className="mx-auto mb-4 h-12 w-12 text-[#151515]" />
              <h1 className="text-3xl font-black tracking-normal">La misión todavía no ha empezado</h1>
              <p className="mt-3 text-[#151515]/70">
                Los retos comienzan a las{" "}
                {new Date(event.start_time || "").toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}.
              </p>
              <div className="mt-5 rounded-[8px] bg-black/25 p-4 text-2xl font-black">Quedan {minutesLeft} minutos</div>
            </GameCard>
            <GameButton disabled>Esperando inicio</GameButton>
          </div>
        </CaptainsShell>
      );
    }

    if (allDone && phase !== "result" && phase !== "expired") {
      go("final");
      return <LoadingScreen />;
    }

    if (!currentRow || !currentChallenge || !currentTable) {
      return (
        <CaptainsShell themeStyle={themeStyle}>
          <div className="flex flex-1 items-center justify-center">
            <GameCard className="text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#151515]" />
              <p className="font-bold">Preparando misiones...</p>
            </GameCard>
          </div>
        </CaptainsShell>
      );
    }

    const timePercent = currentChallenge.has_time_limit
      ? Math.max(0, Math.min(100, (remaining / (currentChallenge.time_limit_seconds || 1)) * 100))
      : 100;

    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="space-y-4 pb-5">
          <GameCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <PixelCaptainSprite table={currentTable} active size="sm" />
                  <div>
                    <h1 className="text-sm">{currentTable.table_name}</h1>
                    <p className="text-xl font-bold text-[#151515]/70">{session?.captain_name}</p>
                  </div>
                </div>
              <div className="pixel-button bg-white px-3 py-2 text-right text-[#151515]">
                <div className="pixel-title text-sm">{totalPoints}</div>
                <div className="text-base font-bold uppercase">pts</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-base font-bold uppercase text-[#151515]/70">
                <span>Ronda {currentIndex} de {tableChallenges.length}</span>
                <span>{Math.round((completedRows.length / Math.max(tableChallenges.length, 1)) * 100)}%</span>
              </div>
              <Progress value={(completedRows.length / Math.max(tableChallenges.length, 1)) * 100} className="h-4 rounded-none bg-[#151515]/15 [&>div]:rounded-none [&>div]:bg-[#151515]" />
            </div>
          </GameCard>

          {phase === "intro" && (
            <GameCard className="animate-scale-in text-center">
                <PixelCaptainSprite table={currentTable} active size="lg" />
                <h2 className="mt-4 text-xl">{currentTable.table_name}</h2>
                <p className="mt-2 text-2xl font-bold text-[#151515]/70">{session?.captain_name}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <PixelStat label={`de ${tableChallenges.length}`} value={`Ronda ${currentIndex}`} tone="secondary" />
                <PixelStat label="puntos" value={totalPoints} tone="gold" />
              </div>
              <GameButton className="mt-5" onClick={() => setPhase("preview")}>
                Ver primera misión
              </GameButton>
            </GameCard>
          )}

          {phase === "preview" && (
            <GameCard className="animate-scale-in">
              <div className="mb-4 flex items-center justify-between">
                <HeroBadge>Ronda {currentIndex}</HeroBadge>
                <span className="pixel-button bg-white px-3 py-1 text-xl font-bold text-[#151515]">{currentChallenge.points} pts</span>
              </div>
              <div className="mt-4 grid gap-2 text-xl font-bold">
                <div className="pixel-button flex items-center gap-2 bg-white p-3">
                  <EvidenceIcon type={currentChallenge.evidence_type} className="h-5 w-5 text-[#151515]" />
                    Reto de tipo {evidenceLabel[currentChallenge.evidence_type]}
                  </div>
                  <div className="pixel-button flex items-center gap-2 bg-white p-3">
                    <Medal className="h-5 w-5 text-[#151515]" />
                    Puntos máximos: {currentChallenge.points}
                  </div>
                  <div className="pixel-button flex items-center gap-2 bg-white p-3">
                    <Clock3 className="h-5 w-5 text-[#151515]" />
                    Tiempo límite: {currentChallenge.has_time_limit ? `${currentChallenge.time_limit_seconds} segundos` : "Sin límite"}
                  </div>
                </div>
              <GameButton className="mt-5" disabled={busy} onClick={startCurrentChallenge}>
                Iniciar reto <Flame className="h-5 w-5" />
              </GameButton>
            </GameCard>
          )}

          {phase === "progress" && (
            <GameCard className="animate-fade-in">
              {currentChallenge.has_time_limit && (
                <div className="mb-5 text-center">
                  <div className="pixel-title text-4xl text-[#151515]">{formatClock(remaining)}</div>
                  <p className="mt-2 text-2xl font-bold text-[#151515]/70">Te quedan {remaining} segundos</p>
                  <Progress value={timePercent} className="mt-4 h-5 rounded-none bg-[#151515]/15 [&>div]:rounded-none [&>div]:bg-[var(--captains-primary)]" />
                </div>
              )}
              <div className="pixel-panel bg-white p-3 text-[#151515]">
                <h2 className="text-base">{currentChallenge.title}</h2>
                <p className="mt-3 text-2xl leading-7">{currentChallenge.description}</p>
              </div>
              {currentChallenge.evidence_type === "question" ? (
                <div className="mt-5 space-y-3">
                  {(currentChallenge.question_options || []).filter(Boolean).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSelectedQuestionOption(option)}
                        className={cn(
                          "pixel-button min-h-14 w-full bg-white px-4 py-3 text-left text-2xl font-bold text-[#151515]",
                        )}
                        style={
                          selectedQuestionOption === option
                            ? { backgroundColor: "rgba(240, 106, 95, 0.18)", borderColor: DEFAULT_CAPTAINS_PRIMARY }
                            : undefined
                        }
                      >
                      {option}
                    </button>
                  ))}
                  <GameButton disabled={busy || !selectedQuestionOption} onClick={submitQuestion}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    Responder
                  </GameButton>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={evidenceAccept[currentChallenge.evidence_type]}
                    capture={evidenceCapture[currentChallenge.evidence_type]}
                    className="hidden"
                    onChange={onPickEvidence}
                  />
                  {evidencePreview && (
                    <div className="pixel-panel mt-4 overflow-hidden bg-white p-2">
                      {currentChallenge.evidence_type === "photo" && <img src={evidencePreview} alt="" className="aspect-[4/3] w-full object-cover" />}
                      {currentChallenge.evidence_type === "video" && (
                        <video
                          src={evidencePreview}
                          poster={evidenceVideoPoster || undefined}
                          controls
                          playsInline
                          preload="auto"
                          className="aspect-[4/3] w-full bg-black object-cover"
                        />
                      )}
                    </div>
                  )}
                  <div className="mt-5 space-y-3">
                    {evidenceFile ? (
                      <>
                        <GameButton disabled={busy} onClick={submitEvidence}>
                          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                          {evidenceConfirmLabel[currentChallenge.evidence_type]}
                        </GameButton>
                          <SecondaryButton disabled={busy} onClick={openEvidenceCapture}>
                            <EvidenceIcon type={currentChallenge.evidence_type} className="h-5 w-5" />
                            {evidenceRetakeLabel[currentChallenge.evidence_type]}
                          </SecondaryButton>
                      </>
                    ) : (
                        <GameButton disabled={busy} onClick={openEvidenceCapture}>
                          <EvidenceIcon type={currentChallenge.evidence_type} className="h-5 w-5" />
                          {evidenceActionLabel[currentChallenge.evidence_type]}
                      </GameButton>
                    )}
                    <SecondaryButton disabled={busy} onClick={failChallenge}>
                      <XCircle className="h-4 w-4" />
                      No conseguido
                    </SecondaryButton>
                  </div>
                </>
              )}
            </GameCard>
          )}

          {(phase === "result" || phase === "expired") && (
            <GameCard className="animate-scale-in text-center">
              {resultKind === "success" && (
                <>
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[#151515]" />
                  <h2 className="text-lg">{lastResultType === "question" ? "¡Respuesta correcta!" : "¡Prueba enviada!"}</h2>
                  <p className="mt-3 text-2xl text-[#151515]/70">
                    {resultEvidence?.elapsed_seconds != null
                      ? `Habéis tardado ${resultEvidence.elapsed_seconds} segundos.`
                      : lastResultType === "question"
                        ? "Habéis acertado la pregunta."
                        : "Evidencia validada."}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#151515]">+{lastResultPoints} puntos</p>
                </>
              )}
              {resultKind === "manual" && (
                <>
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[#151515]" />
                  <h2 className="text-lg">Prueba enviada</h2>
                  <p className="mt-3 text-2xl text-[#151515]/70">El equipo revisará la evidencia y asignará la puntuación.</p>
                </>
              )}
              {resultKind === "failed" && (
                <>
                  <RotateCcw className="mx-auto mb-3 h-12 w-12 text-[#151515]" />
                  <h2 className="text-lg">Reto no conseguido</h2>
                  <p className="mt-3 text-2xl text-[#151515]/70">Esta vez no suma puntos, pero todavía podéis remontar.</p>
                </>
              )}
                {resultKind === "expired" && (
                  <>
                    <Clock3 className="mx-auto mb-3 h-12 w-12 text-[#151515]" />
                    <h2 className="text-lg">Te has quedado sin tiempo</h2>
                    <p className="mt-3 text-2xl text-[#151515]/70">
                      {lastResultType === "question"
                        ? "Misión no completada. No se ha recibido ninguna respuesta."
                        : "Misión no completada. No se ha recibido ninguna foto ni vídeo."}
                    </p>
                  </>
                )}
              {lastResultType === "question" && lastCorrectAnswer && (
                  <div
                    className="mt-4 pixel-panel p-3 text-left text-xl font-bold text-[#151515]"
                    style={{ backgroundColor: "rgba(240, 106, 95, 0.12)", borderColor: DEFAULT_CAPTAINS_PRIMARY }}
                  >
                    Opción correcta: {lastCorrectAnswer}
                  </div>
                )}
                <GameButton className="mt-5" onClick={() => go("ranking")}>Ver ranking</GameButton>
              {resultKind === "expired" && <SecondaryButton className="mt-3" onClick={nextAfterRanking}>Siguiente reto</SecondaryButton>}
            </GameCard>
          )}
        </div>
      </CaptainsShell>
    );
  }

  if (step === "ranking") {
    const rankIndex = myRank?.rank || ranking.length;
    const message = !session && eventEnded
      ? "Clasificación final del evento."
      : rankIndex <= 1
        ? "¡Vais liderando la misión!"
        : rankIndex >= ranking.length
          ? "Nada está perdido. La siguiente misión puede cambiarlo todo."
          : "Vais bien, pero todavía podéis remontar.";

    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="space-y-4 pb-5">
          <div className="pt-3">
            <h1 className="text-3xl">Ranking</h1>
            <p className="mt-2 text-2xl leading-7 text-[#151515]/70">{message}</p>
          </div>
          {eventEnded ? (
            <GameButton onClick={() => go("resumen")}>Ver resumen</GameButton>
          ) : null}
          <div className="space-y-3">
            {ranking.map((item) => {
              const mine = item.id === session?.table_id;
              return (
                  <GameCard
                    key={item.id}
                    className="flex items-center gap-3 p-3"
                    style={mine ? { backgroundColor: "rgba(240, 106, 95, 0.16)", borderColor: DEFAULT_CAPTAINS_PRIMARY } : undefined}
                  >
                    <div
                      className="pixel-button flex h-12 w-12 items-center justify-center bg-white text-2xl font-bold"
                      style={mine ? { borderColor: DEFAULT_CAPTAINS_PRIMARY, color: DEFAULT_CAPTAINS_PRIMARY } : undefined}
                    >
                    {item.rank}
                  </div>
                  <PixelCaptainSprite table={item} active={mine} size="sm" />
                  <div className="min-w-0 flex-1">
                    {eventEnded ? (
                      <button
                        type="button"
                        className="block max-w-full truncate text-left text-2xl font-bold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={() => openTableSummary(item.id)}
                        aria-label={`Ver el resumen de ${item.table_name}`}
                      >
                        {item.table_name}
                      </button>
                    ) : (
                      <p className="truncate text-2xl font-bold">{item.table_name}</p>
                    )}
                    <p className="truncate text-lg text-[#151515]/70">{item.active_captain_name || item.captain_name || "Sin capitán"}</p>
                    <p className="text-base text-[#151515]/60">{item.completed_challenges} retos completados</p>
                  </div>
                  <div className="text-right">
                    <p className="pixel-title text-sm text-[#151515]">{item.total_points}</p>
                    <p className="text-base font-bold uppercase text-[#151515]/60">pts</p>
                  </div>
                </GameCard>
              );
            })}
          </div>
          {!eventEnded ? (
            <GameButton onClick={nextAfterRanking}>{allDone ? "Ver resultado final" : "Siguiente reto"}</GameButton>
          ) : null}
        </div>
      </CaptainsShell>
    );
  }

  if (step === "final") {
    if (!allDone && tableChallenges.length > 0) {
      go("play");
      return <LoadingScreen />;
    }

    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <GameCard className="text-center">
            <PixelCaptainSprite table={currentTable} active size="lg" />
            <Crown className="mx-auto mt-3 h-10 w-10 text-[#151515]" />
            <h1 className="mt-3 text-2xl">{failedCount > 0 ? "Misión finalizada" : "Misión completada"}</h1>
            <p className="mt-3 text-2xl leading-7 text-[#151515]/70">
              {failedCount > 0
                ? `Habéis terminado la partida con ${failedCount} ${failedCount === 1 ? "reto no completado" : "retos no completados"}.`
                : `Habéis completado todos los retos de ${currentTable?.table_name || session?.table_name}.`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <PixelStat label="Retos completados" value={completedRows.filter((row) => row.status === "completed" || row.status === "pending_review").length} tone="secondary" />
              <PixelStat label="No conseguidos" value={failedCount} tone="primary" />
              <PixelStat label="Puntos totales" value={totalPoints} tone="gold" />
              <PixelStat label="Posición" value={`#${myRank?.rank || "-"}`} tone="secondary" />
            </div>
          </GameCard>
          <div className="grid gap-3">
            <GameButton onClick={() => go("ranking")}>Ver ranking</GameButton>
            <SecondaryButton onClick={() => go("resumen")}>Ver resumen</SecondaryButton>
          </div>
        </div>
      </CaptainsShell>
    );
  }

  const onlyMine = liveEvidence.length > 0 && liveEvidence.every((row) => row.table_id === session?.table_id);
  const rowById = new Map(liveRows.map((row) => [row.id, row]));
  const liveEnabled = event.show_live_gallery_after_completion ?? true;
  const liveEventAvailable = event.status === "active" || event.status === "finished";
  const summaryUnlocked = isDemo || allDone || eventEnded;

  if (step === "resumen") {
    if (!summaryUnlocked) {
      return (
        <CaptainsShell themeStyle={themeStyle}>
          <div className="flex flex-1 flex-col justify-center gap-4">
            <GameCard className="text-center">
              <Film className="mx-auto mb-4 h-12 w-12 text-[#151515]" />
              <h1 className="text-3xl font-black tracking-normal">El resumen todavía no está disponible.</h1>
              <p className="mt-2 text-sm leading-6 text-[#151515]/70">
                Se activará cuando todas las mesas terminen o cuando llegue la hora de fin del evento.
              </p>
            </GameCard>
            <GameButton onClick={() => go("ranking")}>Volver al ranking</GameButton>
          </div>
        </CaptainsShell>
      );
    }

    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex min-h-[var(--app-height,100svh)] flex-col gap-4 pb-5">
          <div className="pt-3">
            <h1 className="text-4xl font-black tracking-normal">Resumen de la misión</h1>
            <p className="mt-2 text-sm leading-6 text-[#151515]/70">Explora los recuerdos por mesa o por reto.</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSummaryMode("tables")}
              aria-pressed={summaryMode === "tables"}
              className={cn(
                "pixel-button flex items-center justify-center gap-2 px-3 py-3 text-xl font-bold uppercase transition",
                summaryMode === "tables"
                  ? "border-[#151515] bg-[var(--captains-primary)] text-[#151515] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]"
                  : "bg-white text-[#151515]/60 hover:text-[#151515]",
              )}
            >
              {summaryMode === "tables" ? <CheckCircle2 className="h-5 w-5" /> : null}
              Por mesas
            </button>
            <button
              type="button"
              onClick={() => setSummaryMode("challenges")}
              aria-pressed={summaryMode === "challenges"}
              className={cn(
                "pixel-button flex items-center justify-center gap-2 px-3 py-3 text-xl font-bold uppercase transition",
                summaryMode === "challenges"
                  ? "border-[#151515] bg-[var(--captains-primary)] text-[#151515] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]"
                  : "bg-white text-[#151515]/60 hover:text-[#151515]",
              )}
            >
              {summaryMode === "challenges" ? <CheckCircle2 className="h-5 w-5" /> : null}
              Por retos
            </button>
          </div>

          {summaryMode === "tables" ? (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {tables.map((table) => (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSummarySelectedTableId(table.id)}
                  aria-pressed={summarySelectedTableId === table.id}
                  className={cn(
                    "pixel-button min-w-[136px] px-3 py-2 text-left transition",
                    summarySelectedTableId === table.id
                      ? "border-[#151515] bg-[var(--captains-primary)] text-[#151515] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)]"
                      : "bg-white text-[#151515]/60 hover:text-[#151515]",
                  )}
                >
                  <p className="flex items-center gap-1 truncate text-xl font-bold">
                    {summarySelectedTableId === table.id ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                    <span className="truncate">{table.table_name}</span>
                  </p>
                  <p className={cn("truncate text-base", summarySelectedTableId === table.id ? "text-[#151515]/80" : "text-[#151515]/50")}>
                    {table.active_captain_name || table.captain_name || "Sin capitán"}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <select
              value={summarySelectedChallengeId}
              onChange={(event) => setSummarySelectedChallengeId(event.target.value)}
              className="pixel-button h-14 rounded-none bg-white px-3 text-xl font-bold uppercase text-[#151515] outline-none"
            >
              {summaryVisualChallenges.map((challenge, index) => (
                <option key={challenge.id} value={challenge.id}>
                  Reto {index + 1}: {challenge.title}
                </option>
              ))}
            </select>
          )}

          <section className="pixel-panel relative flex min-h-[540px] flex-1 overflow-hidden bg-white">
            {activeSummaryItem?.evidence ? (
              <>
                <SummaryFullScreenEvidence evidence={activeSummaryItem.evidence} />
                <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4 !text-white [&_h2]:!text-white [&_p]:!text-white [&_span]:!text-white">
                  <p className="text-base font-bold uppercase text-white/80">
                    {summaryMode === "tables" ? summarySelectedTable?.table_name || "Mesa" : `Reto ${Math.max(challenges.findIndex((challenge) => challenge.id === summarySelectedChallengeId) + 1, 1)}`}
                  </p>
                  <h2 className="mt-1 text-3xl font-black leading-none tracking-normal text-white">
                    {summaryMode === "tables" ? activeSummaryItem.challenge?.title : summarySelectedChallenge?.title}
                  </h2>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 !text-white [&_h2]:!text-white [&_p]:!text-white">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-2xl font-bold text-white">{activeSummaryItem.table?.table_name || "Mesa"}</p>
                      <p className="truncate text-lg text-white/80">
                        {activeSummaryItem.evidence.captain_name || activeSummaryItem.table?.active_captain_name || activeSummaryItem.table?.captain_name || "Capitán"}
                      </p>
                      <p className="mt-1 text-base font-bold uppercase text-white/75">
                        {activeSummaryItem.evidence.evidence_type === "video" ? "Vídeo" : "Foto"}
                        {activeSummaryItem.evidence.points_awarded ? ` · +${activeSummaryItem.evidence.points_awarded} pts` : ""}
                      </p>
                    </div>
                    <span className="pixel-button shrink-0 bg-white px-2 py-1 text-base font-bold !text-[#151515]">
                      {activeSummaryItems.length ? summaryEvidenceIndex + 1 : 0}/{activeSummaryItems.length}
                    </span>
                  </div>
                </div>
              </>
            ) : activeSummaryItem ? (
              <div className="flex flex-1 flex-col items-center justify-center bg-[#eeeeee] px-6 text-center text-[#151515]">
                <XCircle className="mb-4 h-14 w-14 text-[#151515]" />
                <p className="text-base font-bold uppercase text-[#151515]">
                  {summaryMode === "tables" ? summarySelectedTable?.table_name || "Mesa" : activeSummaryItem.table?.table_name || "Mesa"}
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-normal text-[#151515]">Reto no conseguido</h2>
                <p className="mt-3 text-lg font-medium text-[#151515]">{activeSummaryItem.challenge?.title || "Prueba sin evidencia"}</p>
                <span className="pixel-button mt-5 bg-white px-2 py-1 text-base font-bold text-[#151515]">
                  {activeSummaryItems.length ? summaryEvidenceIndex + 1 : 0}/{activeSummaryItems.length}
                </span>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-[#eeeeee] px-6 text-center text-[#151515]">
                <ImageIcon className="mb-4 h-14 w-14 text-[#151515]" />
                <h2 className="text-2xl font-black tracking-normal text-[#151515]">No hay retos visuales en este evento</h2>
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              disabled={activeSummaryItems.length <= 1 || summaryEvidenceIndex === 0}
              onClick={() => setSummaryEvidenceIndex((index) => Math.max(0, index - 1))}
            >
              Anterior
            </SecondaryButton>
            <SecondaryButton
              disabled={activeSummaryItems.length <= 1 || summaryEvidenceIndex >= activeSummaryItems.length - 1}
              onClick={() => setSummaryEvidenceIndex((index) => Math.min(activeSummaryItems.length - 1, index + 1))}
            >
              Siguiente
            </SecondaryButton>
          </div>
          <GameButton onClick={shareSummary}>
            <Share2 className="h-5 w-5" />
            {summaryCopied ? "URL copiada" : "Compartir resumen"}
          </GameButton>
          <SecondaryButton onClick={() => go("ranking")}>Volver al ranking</SecondaryButton>
        </div>
      </CaptainsShell>
    );
  }

  if (!liveEventAvailable || !liveEnabled) {
    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <GameCard className="text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-[#151515]" />
            <h1 className="text-3xl font-black tracking-normal">La galería live no está disponible para este evento.</h1>
          </GameCard>
          <GameButton onClick={() => go("ranking")}>Volver al ranking</GameButton>
        </div>
      </CaptainsShell>
    );
  }

  if (!allDone) {
    return (
      <CaptainsShell themeStyle={themeStyle}>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <GameCard className="text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-[#151515]" />
            <h1 className="text-3xl font-black tracking-normal">Todavía quedan misiones por completar.</h1>
            <p className="mt-2 text-sm leading-6 text-[#151515]/70">
              Cuando vuestra mesa termine todos los retos, podréis ver los recuerdos del resto de mesas.
            </p>
          </GameCard>
          <GameButton onClick={() => go("play")}>Volver a misiones</GameButton>
          <SecondaryButton onClick={() => go("ranking")}>Volver al ranking</SecondaryButton>
        </div>
      </CaptainsShell>
    );
  }

  return (
    <CaptainsShell themeStyle={themeStyle}>
      <div className="space-y-4 pb-5">
        <div className="pt-3">
          <HeroBadge>En directo</HeroBadge>
          <h1 className="mt-4 text-4xl font-black tracking-normal">Recuerdos de la misión</h1>
          <p className="mt-2 text-sm leading-6 text-[#151515]/70">Mira lo que están creando el resto de mesas en tiempo real.</p>
        </div>
        <GameCard className="grid grid-cols-2 gap-3 bg-black/20 text-sm">
          <div className="col-span-2">
            <p className="text-xs font-black uppercase text-[#151515]/45">Evento</p>
            <p className="truncate text-base font-black">{event.name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#151515]/45">Mesa</p>
            <p className="font-bold">{currentTable?.table_name || session?.table_name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#151515]/45">Capitán</p>
            <p className="truncate font-bold">{session?.captain_name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#151515]/45">Posición</p>
            <p className="text-xl font-black text-[#151515]">#{myRank?.rank || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-[#151515]/45">Puntos</p>
            <p className="text-xl font-black text-[#151515]">{totalPoints}</p>
          </div>
        </GameCard>
        <div className="grid grid-cols-3 gap-2">
          {(["all", "mine", "others", "photo", "video"] as EvidenceFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setLiveFilter(filter);
                setNewMemoriesAvailable(false);
              }}
              className={cn(
                "min-h-10 border-2 border-[#151515] bg-white px-2 text-xs font-black text-[#151515]",
                liveFilter === filter && "border-[var(--captains-primary)] bg-[var(--captains-primary)]/10",
              )}
            >
              {filter === "all" ? "Todas" : filter === "mine" ? "Mi mesa" : filter === "others" ? "Otras" : evidenceLabel[filter]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={() => go("ranking")}>Volver al ranking</SecondaryButton>
          <SecondaryButton onClick={refreshLive}>
            <RefreshCw className={cn("h-4 w-4", isRefreshingLive && "animate-spin")} />
            Actualizar recuerdos
          </SecondaryButton>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <GameButton className="min-h-12 py-3" onClick={() => go("resumen")}>
            <Film className="h-5 w-5" />
            Ver resumen
          </GameButton>
          <SecondaryButton onClick={shareSummary}>
            <Share2 className="h-4 w-4" />
            {summaryCopied ? "URL copiada" : "Compartir resumen"}
          </SecondaryButton>
        </div>
        {isRefreshingLive && <p className="text-center text-xs font-bold text-[#151515]/70">Actualizando recuerdos...</p>}
        {newMemoriesAvailable && (
          <button
            type="button"
            onClick={() => setNewMemoriesAvailable(false)}
            className="w-full border-2 border-[#151515] bg-white px-3 py-2 text-xs font-black text-[#151515]"
          >
            Nuevos recuerdos disponibles
          </button>
        )}
        {lastRefresh && <p className="text-center text-xs text-[#151515]/45">Actualizado a las {lastRefresh.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>}
        {liveError && (
          <GameCard className="border-[var(--captains-primary)] text-center">
            <p className="font-black">{liveError}</p>
          </GameCard>
        )}
        {filteredEvidence.length === 0 && (
          <GameCard className="text-center">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 text-[#151515]/45" />
            <p className="font-black">
              {isRefreshingLive
                ? "Cargando recuerdos..."
                : liveEvidence.length === 0
                  ? "Todavía no hay recuerdos disponibles."
                  : onlyMine
                    ? "Cuando otras mesas suban sus pruebas, aparecerán aquí."
                    : "No hay recuerdos con este filtro."}
            </p>
          </GameCard>
        )}
        <div className="space-y-4">
          {visibleLiveEvidence.map((evidence) => {
            const table = tableById.get(evidence.table_id);
            const row = rowById.get(evidence.table_challenge_id);
            const challenge = row ? challengeById.get(row.challenge_id) : null;
            return (
              <GameCard key={evidence.id} className="p-3">
                <SignedEvidenceMedia evidence={evidence} onPhotoOpen={(url) => setPhotoModalUrl(url)} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">
                      {table?.table_name || "Mesa"} - {evidence.captain_name || table?.active_captain_name || table?.captain_name || "-"}
                    </p>
                    <p className="truncate text-xs text-[#151515]/60">Capitán: {evidence.captain_name || table?.active_captain_name || table?.captain_name || "-"}</p>
                    <p className="mt-1 text-sm font-bold text-[#151515]">Reto: {challenge?.title || "Reto"}</p>
                  </div>
                  <div className="shrink-0 rounded-[8px] bg-black/25 px-2 py-1 text-xs font-black">
                    {evidenceLabel[evidence.evidence_type]}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#151515]/55">
                  <span>{formatRelativeTime(evidence.created_at)}</span>
                  {evidence.status === "pending_review" && <span className="border border-[#151515] bg-white px-2 py-1 font-black text-[#151515]">Pendiente de revisión</span>}
                  {evidence.status === "approved" && evidence.points_awarded > 0 && (
                    <span className="border border-[#151515] bg-white px-2 py-1 font-black text-[#151515]">+{evidence.points_awarded} puntos</span>
                  )}
                </div>
                {evidence.evidence_type === "photo" && (
                  <SecondaryButton className="mt-3" onClick={() => openPhotoEvidence(evidence)}>
                    <Eye className="h-4 w-4" />
                    Ver
                  </SecondaryButton>
                )}
              </GameCard>
            );
          })}
        </div>
        {filteredEvidence.length > visibleMemoriesLimit && (
          <SecondaryButton onClick={() => setVisibleMemoriesLimit((limit) => limit + 20)}>
            Cargar más recuerdos
          </SecondaryButton>
        )}
        {photoModalUrl && (
          <button
            type="button"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setPhotoModalUrl("")}
            aria-label="Cerrar imagen"
          >
            <img src={photoModalUrl} alt="" className="max-h-full max-w-full rounded-[8px] object-contain" />
          </button>
        )}
      </div>
    </CaptainsShell>
  );
}
