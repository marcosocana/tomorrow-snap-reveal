import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
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
} from "@/lib/captainsTypes";
import { useCaptainsEventDetail } from "@/hooks/useCaptains";
import { calculateCaptainsAutomaticScore, shuffleCaptainsItems } from "@/lib/captainsUtils";
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
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
  Trophy,
  Users,
  Volume2,
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

const sessionKey = (slug: string) => `captains-session:${slug}`;
const demoRowsKey = (slug: string, tableId: string) => `captains-demo-rows:${slug}:${tableId}`;
const demoEvidenceKey = (slug: string) => `captains-demo-evidence:${slug}`;

const nowIso = () => new Date().toISOString();

const demoEventDetail: CaptainsEventDetail = {
  event: {
    id: "demo-event-capitanes",
    name: "Demo Capitanes by Revelao",
    slug: DEMO_SLUG,
    description:
      "Una partida de prueba para ver la experiencia pública: mesas, retos, puntos, ranking y recuerdos en directo.",
    start_time: null,
    end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scoring_mode: "automatic",
    status: "active",
    show_live_gallery_after_completion: true,
    primary_color: DEFAULT_CAPTAINS_PRIMARY,
    secondary_color: DEFAULT_CAPTAINS_SECONDARY,
    background_image_url: null,
    qr_url: `/capitanes/${DEMO_SLUG}`,
    public_url: `/capitanes/${DEMO_SLUG}`,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  tables: [
    {
      id: "demo-table-1",
      event_id: "demo-event-capitanes",
      table_number: 1,
      table_name: "Mesa 1",
      captain_name: "Jorge",
      active_captain_name: "Jorge",
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
      id: "demo-table-2",
      event_id: "demo-event-capitanes",
      table_number: 2,
      table_name: "Mesa 2",
      captain_name: "Marta",
      active_captain_name: "Marta",
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
      id: "demo-table-3",
      event_id: "demo-event-capitanes",
      table_number: 3,
      table_name: "Mesa 3",
      captain_name: "Laura",
      active_captain_name: "Laura",
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
      id: "demo-table-4",
      event_id: "demo-event-capitanes",
      table_number: 4,
      table_name: "Mesa 4",
      captain_name: "Dani",
      active_captain_name: "Dani",
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
      id: "demo-table-5",
      event_id: "demo-event-capitanes",
      table_number: 5,
      table_name: "Mesa 5",
      captain_name: null,
      active_captain_name: null,
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
      id: "demo-challenge-1",
      event_id: "demo-event-capitanes",
      catalog_challenge_id: null,
      title: "Brindis de mesa",
      description: "Haced una foto de toda la mesa brindando por los novios.",
      evidence_type: "photo",
      points: 20,
      category: "Mesa",
      difficulty: "easy",
      has_time_limit: false,
      time_limit_seconds: null,
      order_index: 1,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "demo-challenge-2",
      event_id: "demo-event-capitanes",
      catalog_challenge_id: null,
      title: "Grito de guerra",
      description: "Grabad un audio corto con el grito de guerra de vuestra mesa.",
      evidence_type: "audio",
      points: 15,
      category: "Audio",
      difficulty: "medium",
      has_time_limit: true,
      time_limit_seconds: 60,
      order_index: 2,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "demo-challenge-3",
      event_id: "demo-event-capitanes",
      catalog_challenge_id: null,
      title: "Mensaje secreto",
      description: "Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.",
      evidence_type: "video",
      points: 25,
      category: "Emotivo",
      difficulty: "special",
      has_time_limit: true,
      time_limit_seconds: 90,
      order_index: 3,
      is_required: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      id: "demo-challenge-4",
      event_id: "demo-event-capitanes",
      catalog_challenge_id: null,
      title: "Aliados de otra mesa",
      description: "Haced una foto con alguien de otra mesa.",
      evidence_type: "photo",
      points: 15,
      category: "Interacción",
      difficulty: "medium",
      has_time_limit: false,
      time_limit_seconds: null,
      order_index: 4,
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
    event_id: "demo-event-capitanes",
    table_id: "demo-table-1",
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
    event_id: "demo-event-capitanes",
    table_id: "demo-table-2",
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
    event_id: "demo-event-capitanes",
    table_id: "demo-table-3",
    table_challenge_id: "demo-sample-row-3",
    captain_name: "Laura",
    evidence_type: "audio",
    file_url: "",
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
    event_id: "demo-event-capitanes",
    table_id: "demo-table-1",
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
  ["demo-sample-row-1", "demo-table-1", "demo-challenge-1", 1],
  ["demo-sample-row-2", "demo-table-2", "demo-challenge-1", 1],
  ["demo-sample-row-3", "demo-table-3", "demo-challenge-2", 2],
  ["demo-sample-row-4", "demo-table-1", "demo-challenge-3", 3],
].map(([id, tableId, challengeId, order]) => ({
  id: String(id),
  event_id: "demo-event-capitanes",
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
  audio: "Audio",
};

const evidenceAccept: Record<CaptainsEvidenceType, string> = {
  photo: "image/*",
  video: "video/*",
  audio: "audio/*",
};

const evidenceActionLabel: Record<CaptainsEvidenceType, string> = {
  photo: "Hacer foto",
  video: "Grabar vídeo",
  audio: "Grabar audio",
};

const evidenceRetakeLabel: Record<CaptainsEvidenceType, string> = {
  photo: "Repetir foto",
  video: "Grabar otro vídeo",
  audio: "Grabar otro audio",
};

const evidenceConfirmLabel: Record<CaptainsEvidenceType, string> = {
  photo: "Usar foto",
  video: "Usar vídeo",
  audio: "Usar audio",
};

const evidenceCapture: Record<CaptainsEvidenceType, "environment" | "user"> = {
  photo: "environment",
  video: "environment",
  audio: "user",
};

const EvidenceIcon = ({ type, className }: { type: CaptainsEvidenceType; className?: string }) => {
  const Icon = type === "photo" ? Camera : type === "video" ? Film : Mic;
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
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const mobileUa = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setState({ ready: true, allowed: width <= 768 && (coarse || mobileUa), width });
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

const CaptainsShell = ({ children }: { children: React.ReactNode }) => (
  <main className="captains-public min-h-[var(--app-height,100svh)] bg-white text-[#151515]">
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
      .captains-public h1,
      .captains-public h2,
      .captains-public .pixel-title {
        font-family: "Press Start 2P", ui-monospace, monospace;
        font-weight: 400;
        letter-spacing: 0;
        line-height: 1.25;
        text-shadow: none;
      }
      .captains-public {
        font-family: "VT323", ui-monospace, monospace;
        image-rendering: pixelated;
      }
      .captains-public button,
      .captains-public input,
      .captains-public p,
      .captains-public span {
        letter-spacing: 0;
      }
      .captains-public button,
      .captains-public input {
        font-family: "VT323", ui-monospace, monospace;
      }
      .pixel-panel {
        border: 3px solid #151515;
        box-shadow: none;
      }
      .pixel-button {
        border: 3px solid #151515;
        box-shadow: none;
      }
      .pixel-button:active {
        transform: translate(2px, 2px);
        box-shadow: none;
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
        border: 3px solid #151515;
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
    <div className="fixed inset-0 opacity-100 [background-image:linear-gradient(90deg,rgba(21,21,21,.06)_1px,transparent_1px),linear-gradient(rgba(21,21,21,.06)_1px,transparent_1px)] [background-size:20px_20px]" />
    <div className="fixed inset-x-0 top-0 h-2 bg-[var(--captains-primary)]" />
    <div className="relative mx-auto flex min-h-[var(--app-height,100svh)] w-full max-w-[430px] flex-col px-4 py-5">
      {children}
    </div>
  </main>
);

const GameCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section
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
      "pixel-button min-h-14 w-full rounded-none bg-[var(--captains-primary)] px-5 py-4 text-2xl font-bold uppercase text-[#151515] hover:bg-[var(--captains-primary)] hover:brightness-105",
      className,
    )}
  />
);

const SecondaryButton = ({ className, ...props }: React.ComponentProps<typeof Button>) => (
  <Button
    {...props}
    variant="outline"
    className={cn(
      "pixel-button h-12 w-full rounded-none bg-white text-xl font-bold uppercase text-[#151515] hover:bg-neutral-100 hover:text-[#151515]",
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
              active && "border-[var(--captains-primary)] bg-[var(--captains-primary)]/10",
            )}
          >
            <div className="absolute right-2 top-2 bg-[#151515] px-2 py-1 text-sm font-bold text-white">
              #{table.table_number}
            </div>
            <div className="pt-3">
              <PixelCaptainSprite table={table} active={active} size="md" />
            </div>
            <p className="mt-3 truncate text-2xl font-bold leading-none">{table.table_name}</p>
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

const SignedEvidenceMedia = ({
  evidence,
  onPhotoOpen,
}: {
  evidence: CaptainsEvidence;
  onPhotoOpen?: (url: string) => void;
}) => {
  const [url, setUrl] = useState("");

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
    return <video src={url} controls preload="metadata" className="aspect-[4/3] w-full rounded-[8px] bg-black object-cover" />;
  }

  return (
    <div className="rounded-[8px] bg-black/25 p-4">
      <audio src={url} controls className="w-full" />
    </div>
  );
};

const SummaryEvidenceThumb = ({ evidence }: { evidence: CaptainsEvidence }) => {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (!evidence.file_url) {
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
  }, [evidence.file_url]);

  if (url && evidence.evidence_type === "photo") {
    return <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />;
  }

  if (url && evidence.evidence_type === "video") {
    if (url.startsWith("data:image")) {
      return <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />;
    }
    return <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />;
  }

  return <EvidenceIcon type={evidence.evidence_type} className="h-10 w-10 text-[#151515]" />;
};

export default function CaptainsPublic() {
  const { eventSlug = "" } = useParams();
  const navigate = useNavigate();
  const step = getPublicStep(window.location.pathname);
  const mobile = useIsMobileCaptainDevice();
  const isDemo = eventSlug === DEMO_SLUG;
  const eventQuery = useCaptainsEventDetail(isDemo ? null : eventSlug);
  const detail = isDemo ? demoEventDetail : eventQuery.data;
  const event = detail?.event;
  const tables = detail?.tables || [];
  const challenges = detail?.challenges || [];
  const [session, setSession] = useState<CaptainSession | null>(null);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [captainNameInput, setCaptainNameInput] = useState("");
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tableChallenges, setTableChallenges] = useState<CaptainsTableChallenge[]>([]);
  const [ranking, setRanking] = useState<CaptainsRankingItem[]>([]);
  const [phase, setPhase] = useState<ChallengePhase>("intro");
  const [resultKind, setResultKind] = useState<ResultKind>("success");
  const [resultEvidence, setResultEvidence] = useState<CaptainsEvidence | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState("");
  const [liveEvidence, setLiveEvidence] = useState<CaptainsEvidence[]>([]);
  const [liveRows, setLiveRows] = useState<CaptainsTableChallenge[]>([]);
  const [liveFilter, setLiveFilter] = useState<EvidenceFilter>("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);
  const [liveError, setLiveError] = useState("");
  const [newMemoriesAvailable, setNewMemoriesAvailable] = useState(false);
  const [visibleMemoriesLimit, setVisibleMemoriesLimit] = useState(20);
  const [photoModalUrl, setPhotoModalUrl] = useState("");
  const [summaryIndex, setSummaryIndex] = useState(0);
  const [isSummaryPlaying, setIsSummaryPlaying] = useState(true);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    const raw = localStorage.getItem(sessionKey(eventSlug));
    if (!raw) return;
    try {
      setSession(JSON.parse(raw) as CaptainSession);
    } catch {
      localStorage.removeItem(sessionKey(eventSlug));
    }
  }, [eventSlug]);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [selectedTableId, tables],
  );
  const currentTable = useMemo(
    () => tables.find((table) => table.id === session?.table_id) || null,
    [session?.table_id, tables],
  );

  const challengeById = useMemo(() => {
    const map = new Map<string, CaptainsEventChallenge>();
    challenges.forEach((challenge) => map.set(challenge.id, challenge));
    return map;
  }, [challenges]);

  const currentRow = useMemo(() => {
    const active = tableChallenges.find((row) => ["ready", "in_progress"].includes(row.status));
    if (active) return active;
    return tableChallenges.find((row) => !terminalStatuses.has(row.status)) || null;
  }, [tableChallenges]);

  const currentChallenge = currentRow ? challengeById.get(currentRow.challenge_id) || null : null;
  const completedRows = tableChallenges.filter((row) => terminalStatuses.has(row.status));
  const allDone = tableChallenges.length > 0 && completedRows.length === tableChallenges.length;
  const hasStartedGame = tableChallenges.some((row) => row.status !== "pending" && row.status !== "ready");
  const currentIndex = currentRow?.randomized_order_index || Math.min(completedRows.length + 1, Math.max(tableChallenges.length, 1));
  const myRank = ranking.find((item) => item.id === session?.table_id) || null;
  const totalPoints = myRank?.total_points ?? currentTable?.total_points ?? 0;
  const failedCount = tableChallenges.filter((row) => ["failed", "time_expired", "rejected"].includes(row.status)).length;

  const publicUrl =
    isDemo && eventSlug
      ? `${window.location.origin}/capitanes/${eventSlug}`
      : event?.public_url || (eventSlug ? `${window.location.origin}/capitanes/${eventSlug}` : "");

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
      eventQuery.refetch(),
    ]);
    setTableChallenges(rows);
    setRanking(rank);
  };

  useEffect(() => {
    if (!event || !session || !["play", "ranking", "final", "live", "resumen"].includes(step)) return;
    refreshGame();
  }, [event?.id, session?.table_id, step]);

  useEffect(() => {
    if (step !== "play" || !currentRow) return;
    if (currentRow.status === "in_progress") {
      setPhase("progress");
      return;
    }
    if (phase === "result" || phase === "expired") return;
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
        setPhase("expired");
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
        await expireCaptainsTableChallenge(currentRow.id);
        await refreshGame();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [step, phase, currentRow?.id, currentRow?.started_at, currentChallenge?.id]);

  useEffect(() => {
    if (!evidenceFile) {
      setEvidencePreview("");
      return;
    }
    const url = URL.createObjectURL(evidenceFile);
    setEvidencePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [evidenceFile]);

  const go = (next: PublicStep) => {
    const suffix = next === "home" ? "" : `/${next}`;
    navigate(`/capitanes/${eventSlug}${suffix}`);
  };

  const needsWait = event?.start_time && new Date(event.start_time).getTime() > Date.now();
  const minutesLeft = event?.start_time
    ? Math.max(0, Math.ceil((new Date(event.start_time).getTime() - Date.now()) / 60000))
    : 0;

  const handleTableSelect = (tableId: string) => {
    setSelectedTableId(tableId);
    const table = tables.find((item) => item.id === tableId);
    setCaptainNameInput(table?.captain_name || "");
    setShowActiveWarning(Boolean(table?.last_activity_at || table?.active_captain_name));
  };

  const enterGame = async () => {
    if (!event || !selectedTable) return;
    const cleanName = (captainNameInput || selectedTable.captain_name || selectedTable.active_captain_name || "").trim();
    if (!cleanName) return;
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  const startCurrentChallenge = async () => {
    if (!currentRow) return;
    setBusy(true);
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
    if (currentChallenge.has_time_limit && remaining <= 0) return;
    setBusy(true);
    try {
      const total = currentChallenge.time_limit_seconds || null;
      const elapsed = currentChallenge.has_time_limit && total ? Math.max(0, total - remaining) : null;
      if (isDemo) {
        const pointsAwarded = calculateCaptainsAutomaticScore({
          maxPoints: currentChallenge.points,
          hasTimeLimit: currentChallenge.has_time_limit,
          totalSeconds: total,
          remainingSeconds: currentChallenge.has_time_limit ? remaining : null,
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
          remaining_seconds: currentChallenge.has_time_limit ? remaining : null,
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
          remaining_seconds: currentChallenge.has_time_limit ? remaining : null,
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
        evidenceType: currentChallenge.evidence_type,
        file: evidenceFile,
        elapsedSeconds: elapsed,
        remainingSeconds: currentChallenge.has_time_limit ? remaining : null,
        scoringMode: event.scoring_mode,
      });
      setResultEvidence(evidence);
      setResultKind(event.scoring_mode === "manual" ? "manual" : "success");
      setPhase("result");
      setEvidenceFile(null);
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
        setResultKind("failed");
        setPhase("result");
        return;
      }

      await failCaptainsTableChallenge(currentRow.id);
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
    const url = `${window.location.origin}/capitanes/${eventSlug}/resumen`;
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
        const rows = getDemoEvidence().filter((row) => (row.file_url || row.evidence_type === "audio") && !["deleted", "rejected"].includes(row.status));
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
    if (["photo", "video", "audio"].includes(liveFilter)) return evidence.evidence_type === liveFilter;
    return true;
  });
  const visibleLiveEvidence = filteredEvidence.slice(0, visibleMemoriesLimit);
  const summarySourceEvidence = isDemo && liveEvidence.length === 0 ? demoSummaryEvidence() : liveEvidence;
  const summaryRows = isDemo && liveRows.length === 0 ? demoSampleRows() : liveRows;
  const summaryEvidence = summarySourceEvidence.filter((evidence) => evidence.file_url || evidence.evidence_type === "audio");
  const summarySlides = [
    { type: "cover" as const, id: "cover", title: event?.name || "Capitanes by Revelao", evidences: [] as CaptainsEvidence[] },
    ...challenges.map((challenge, index) => ({
      type: "challenge" as const,
      id: challenge.id,
      title: `Reto ${index + 1}: ${challenge.title}`,
      evidences: summaryEvidence.filter((evidence) => {
        const row = summaryRows.find((item) => item.id === evidence.table_challenge_id);
        return row?.challenge_id === challenge.id;
      }),
    })),
    { type: "closing" as const, id: "closing", title: "Misión completada", evidences: [] as CaptainsEvidence[] },
  ];
  const activeSummarySlide = summarySlides[Math.min(summaryIndex, summarySlides.length - 1)] || summarySlides[0];

  useEffect(() => {
    if (step !== "resumen" || !isSummaryPlaying || summarySlides.length <= 1) return;
    const id = window.setInterval(() => {
      setSummaryIndex((index) => (index + 1) % summarySlides.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, [step, isSummaryPlaying, summarySlides.length]);

  if ((!isDemo && eventQuery.isLoading) || !mobile.ready) return <LoadingScreen />;
  if (!event || !detail) {
    return (
      <CaptainsShell>
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

  if (step === "home") {
    return (
      <CaptainsShell>
        <div className="flex flex-1 flex-col justify-center gap-5">
          <div>
            <HeroBadge>Nueva partida</HeroBadge>
            <h1 className="mt-4 text-3xl leading-relaxed">{event.name}</h1>
            <p className="mt-3 text-2xl font-bold uppercase text-[#151515]/70">Capitanes RPG by Revelao</p>
          </div>
          <GameCard className="relative overflow-hidden">
            <div className="absolute right-4 top-3 h-4 w-4 border-2 border-[#151515] bg-[var(--captains-primary)]" />
            <div className="flex items-start gap-3">
              <div className="pixel-button bg-[var(--captains-secondary)] p-3">
                <Trophy className="h-7 w-7 text-[#151515]" />
              </div>
              <p className="text-2xl leading-7 text-[#151515]">
                {event.description || "Reúne a tu mesa, cread recuerdos y superad pequeños retos durante la celebración."}
              </p>
            </div>
          </GameCard>
          <PixelTableMap tables={tables} selectedTableId={selectedTableId} onSelect={handleTableSelect} />
          <GameButton onClick={() => go("start")}>
            Empezar aventura <ChevronRight className="h-5 w-5" />
          </GameButton>
        </div>
      </CaptainsShell>
    );
  }

  if (step === "start") {
    const requiresCaptainName = selectedTable && !selectedTable.captain_name;
    const canEnter = selectedTable && (selectedTable.captain_name || captainNameInput.trim());
    return (
      <CaptainsShell>
        <div className="space-y-4 pb-5">
          <div className="pt-3">
            <HeroBadge>Zona inicial</HeroBadge>
            <h1 className="mt-4 text-3xl">Elige tu mesa</h1>
            <p className="mt-2 text-2xl leading-7 text-[#151515]/70">Selecciona tu capitán y empieza la aventura.</p>
          </div>
          <PixelTableMap tables={tables} selectedTableId={selectedTableId} onSelect={handleTableSelect} />
          {requiresCaptainName && (
            <GameCard>
              <label className="pixel-title text-xs text-[#151515]">NOMBRE CAPITÁN</label>
              <input
                value={captainNameInput}
                onChange={(event) => setCaptainNameInput(event.target.value)}
                className="pixel-button mt-3 h-14 w-full rounded-none bg-white px-3 text-2xl font-bold text-[#151515] outline-none"
                placeholder="Nombre del capitán"
              />
            </GameCard>
          )}
          {showActiveWarning && selectedTable && (
            <GameCard className="border-[var(--captains-primary)] bg-white">
              <h2 className="text-lg">Mesa ocupada</h2>
              <p className="mt-2 text-2xl leading-7 text-[#151515]">
                Si eres el capitán de esta mesa, puedes continuar. Si no, elige otra mesa.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SecondaryButton onClick={() => setShowActiveWarning(false)}>Continuar</SecondaryButton>
                <SecondaryButton onClick={() => setSelectedTableId("")}>Cambiar selección</SecondaryButton>
              </div>
            </GameCard>
          )}
          <GameButton disabled={!canEnter || busy || showActiveWarning} onClick={enterGame}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
            Entrar al juego
          </GameButton>
        </div>
      </CaptainsShell>
    );
  }

  if (!session) {
    go("start");
    return <LoadingScreen />;
  }

  if (step === "play") {
    if (needsWait) {
      return (
        <CaptainsShell>
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

    if (allDone) {
      go("final");
      return <LoadingScreen />;
    }

    if (!currentRow || !currentChallenge || !currentTable) {
      return (
        <CaptainsShell>
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
      <CaptainsShell>
        <div className="space-y-4 pb-5">
          <GameCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PixelCaptainSprite table={currentTable} active size="sm" />
                <div>
                  <h1 className="text-sm">{currentTable.table_name}</h1>
                  <p className="text-xl font-bold text-[#151515]/70">Capitán: {session?.captain_name}</p>
                </div>
              </div>
              <div className="pixel-button bg-white px-3 py-2 text-right text-[#151515]">
                <div className="pixel-title text-sm">{totalPoints}</div>
                <div className="text-base font-bold uppercase">pts</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-base font-bold uppercase text-[#151515]/70">
                <span>Reto {currentIndex} de {tableChallenges.length}</span>
                <span>{Math.round((completedRows.length / Math.max(tableChallenges.length, 1)) * 100)}%</span>
              </div>
              <Progress value={(completedRows.length / Math.max(tableChallenges.length, 1)) * 100} className="h-4 rounded-none bg-[#151515]/15 [&>div]:rounded-none [&>div]:bg-[#151515]" />
            </div>
          </GameCard>

          {phase === "intro" && (
            <GameCard className="animate-scale-in text-center">
              <PixelCaptainSprite table={currentTable} active size="lg" />
              <h2 className="mt-4 text-xl">{currentTable.table_name}</h2>
              <p className="mt-2 text-2xl font-bold text-[#151515]/70">Capitán: {session?.captain_name}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <PixelStat label={`de ${tableChallenges.length}`} value={`R${currentIndex}`} tone="secondary" />
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
                <HeroBadge>Misión {currentIndex}</HeroBadge>
                <span className="pixel-button bg-white px-3 py-1 text-xl font-bold text-[#151515]">{currentChallenge.points} pts</span>
              </div>
              <div className="pixel-panel bg-white p-3 text-[#151515]">
                <h2 className="text-lg">{currentChallenge.title}</h2>
                <p className="mt-3 text-2xl leading-7">{currentChallenge.description}</p>
              </div>
              <div className="mt-4 grid gap-2 text-xl font-bold">
                <div className="pixel-button flex items-center gap-2 bg-white p-3">
                  <EvidenceIcon type={currentChallenge.evidence_type} className="h-5 w-5 text-[#151515]" />
                  Evidencia necesaria: {evidenceLabel[currentChallenge.evidence_type]}
                </div>
                <div className="pixel-button flex items-center gap-2 bg-white p-3">
                  <Medal className="h-5 w-5 text-[#151515]" />
                  Puntos máximos: {currentChallenge.points}
                </div>
                {currentChallenge.has_time_limit && (
                  <div className="pixel-button flex items-center gap-2 bg-white p-3">
                    <Clock3 className="h-5 w-5 text-[#151515]" />
                    Tiempo límite: {currentChallenge.time_limit_seconds} segundos
                  </div>
                )}
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
                  {currentChallenge.evidence_type === "video" && <video src={evidencePreview} controls className="aspect-[4/3] w-full object-cover" />}
                  {currentChallenge.evidence_type === "audio" && <audio src={evidencePreview} controls className="w-full p-3" />}
                </div>
              )}
              <div className="mt-5 space-y-3">
                <GameButton onClick={openEvidenceCapture}>
                  <EvidenceIcon type={currentChallenge.evidence_type} className="h-5 w-5" />
                  {evidenceFile
                    ? evidenceRetakeLabel[currentChallenge.evidence_type]
                    : evidenceActionLabel[currentChallenge.evidence_type]}
                </GameButton>
                {evidenceFile && (
                  <GameButton disabled={busy} onClick={submitEvidence} className="border-[var(--captains-primary)] bg-[var(--captains-primary)]/10 text-[#151515] hover:bg-[var(--captains-primary)]/15">
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    {evidenceConfirmLabel[currentChallenge.evidence_type]}
                  </GameButton>
                )}
                <SecondaryButton disabled={busy} onClick={failChallenge}>
                  <XCircle className="h-4 w-4" />
                  No conseguido
                </SecondaryButton>
              </div>
            </GameCard>
          )}

          {(phase === "result" || phase === "expired") && (
            <GameCard className="animate-scale-in text-center">
              {resultKind === "success" && (
                <>
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[#151515]" />
                  <h2 className="text-lg">¡Prueba enviada!</h2>
                  <p className="mt-3 text-2xl text-[#151515]/70">
                    {resultEvidence?.elapsed_seconds != null ? `Habéis tardado ${resultEvidence.elapsed_seconds} segundos.` : "Evidencia validada."}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#151515]">+{resultEvidence?.points_awarded || 0} puntos</p>
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
                  <h2 className="text-lg">Tiempo agotado</h2>
                  <p className="mt-3 text-2xl text-[#151515]/70">Esta misión se ha quedado sin tiempo. Podéis pasar a la siguiente.</p>
                </>
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
    const message =
      rankIndex <= 1
        ? "¡Vais liderando la misión!"
        : rankIndex >= ranking.length
          ? "Nada está perdido. La siguiente misión puede cambiarlo todo."
          : "Vais bien, pero todavía podéis remontar.";

    return (
      <CaptainsShell>
        <div className="space-y-4 pb-5">
          <div className="pt-3">
            <HeroBadge>Ranking</HeroBadge>
            <h1 className="mt-4 text-3xl">Ranking</h1>
            <p className="mt-2 text-2xl leading-7 text-[#151515]/70">{message}</p>
          </div>
          <div className="space-y-3">
            {ranking.map((item) => {
              const mine = item.id === session?.table_id;
              return (
                <GameCard key={item.id} className={cn("flex items-center gap-3 p-3", mine && "border-[var(--captains-primary)] bg-[var(--captains-primary)]/10")}>
                  <div className={cn("pixel-button flex h-12 w-12 items-center justify-center bg-white text-2xl font-bold", mine && "border-[var(--captains-primary)]")}>
                    {item.rank}
                  </div>
                  <PixelCaptainSprite table={item} active={mine} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-2xl font-bold">{item.table_name}</p>
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
          <GameButton onClick={nextAfterRanking}>{allDone ? "Ver resultado final" : "Siguiente reto"}</GameButton>
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
      <CaptainsShell>
        <div className="flex flex-1 flex-col justify-center gap-4">
          <GameCard className="text-center">
            <PixelCaptainSprite table={currentTable} active size="lg" />
            <Crown className="mx-auto mt-3 h-10 w-10 text-[#151515]" />
            <h1 className="mt-3 text-2xl">Misión completada</h1>
            <p className="mt-3 text-2xl leading-7 text-[#151515]/70">Habéis terminado todos los retos de {currentTable?.table_name || session?.table_name}.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <PixelStat label="Retos completados" value={completedRows.filter((row) => row.status === "completed" || row.status === "pending_review").length} tone="secondary" />
              <PixelStat label="No conseguidos" value={failedCount} tone="primary" />
              <PixelStat label="Puntos totales" value={totalPoints} tone="gold" />
              <PixelStat label="Posición" value={`#${myRank?.rank || "-"}`} tone="secondary" />
            </div>
          </GameCard>
          <GameButton onClick={() => go("ranking")}>Ver ranking final</GameButton>
          <SecondaryButton onClick={() => go("live")}>Ver recuerdos de la misión</SecondaryButton>
          <SecondaryButton onClick={() => go("resumen")}>Ver resumen</SecondaryButton>
        </div>
      </CaptainsShell>
    );
  }

  const onlyMine = liveEvidence.length > 0 && liveEvidence.every((row) => row.table_id === session?.table_id);
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const rowById = new Map(liveRows.map((row) => [row.id, row]));
  const liveEnabled = event.show_live_gallery_after_completion ?? true;
  const liveEventAvailable = event.status === "active" || event.status === "finished";
  const endTimeReached = event.end_time ? new Date(event.end_time).getTime() <= Date.now() : false;
  const summaryUnlocked = isDemo || allDone || endTimeReached || event.status === "finished";

  if (step === "resumen") {
    if (!summaryUnlocked) {
      return (
        <CaptainsShell>
          <div className="flex flex-1 flex-col justify-center gap-4">
            <GameCard className="text-center">
              <Film className="mx-auto mb-4 h-12 w-12 text-[#151515]" />
              <h1 className="text-3xl font-black tracking-normal">El resumen todavía no está disponible.</h1>
              <p className="mt-2 text-sm leading-6 text-[#151515]/70">
                Se activará cuando todas las mesas terminen o cuando llegue la hora de fin del evento.
              </p>
            </GameCard>
            <GameButton onClick={() => go("live")}>Volver a recuerdos</GameButton>
          </div>
        </CaptainsShell>
      );
    }

    return (
      <CaptainsShell>
        <div className="flex min-h-[var(--app-height,100svh)] flex-col gap-4 pb-5">
          <div className="pt-3">
            <HeroBadge>Resumen</HeroBadge>
            <h1 className="mt-4 text-4xl font-black tracking-normal">Resumen de la misión</h1>
            <p className="mt-2 text-sm leading-6 text-[#151515]/70">Un vídeo único con los retos y evidencias de las mesas.</p>
          </div>

          <section className="pixel-panel relative flex min-h-[520px] flex-1 overflow-hidden bg-white">
            <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(90deg,rgba(21,21,21,.06)_1px,transparent_1px),linear-gradient(rgba(21,21,21,.06)_1px,transparent_1px)] [background-size:20px_20px]" />
            <div className="relative flex w-full flex-col p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black uppercase text-[#151515]/55">
                <span>{activeSummarySlide.type === "cover" ? "Intro" : activeSummarySlide.type === "closing" ? "Final" : activeSummarySlide.title}</span>
                <span>{summaryIndex + 1}/{summarySlides.length}</span>
              </div>
              <Progress value={((summaryIndex + 1) / summarySlides.length) * 100} className="mb-4 h-2 rounded-none bg-[#151515]/15 [&>div]:rounded-none [&>div]:bg-[#151515]" />

              {activeSummarySlide.type === "cover" && (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <Trophy className="mb-5 h-20 w-20 text-[#151515]" />
                  <h2 className="text-5xl font-black leading-none tracking-normal">{event.name}</h2>
                  <p className="mt-4 text-lg font-bold text-[#151515]/70">Capitanes by Revelao</p>
                  <p className="mt-2 text-sm text-[#151515]/55">{summaryEvidence.length} recuerdos en el montaje</p>
                </div>
              )}

              {activeSummarySlide.type === "challenge" && (
                <div className="flex flex-1 flex-col">
                  <h2 className="text-3xl font-black tracking-normal">{activeSummarySlide.title}</h2>
                  {activeSummarySlide.evidences.length === 0 ? (
                    <div className="pixel-panel mt-5 flex flex-1 items-center justify-center bg-white text-center">
                      <p className="px-6 text-sm font-bold text-[#151515]/60">Todavía no hay evidencias para este reto.</p>
                    </div>
                  ) : (
                    <div className="mt-4 grid flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-hidden">
                      {activeSummarySlide.evidences.slice(0, 3).map((evidence) => {
                        const table = tableById.get(evidence.table_id);
                        return (
                          <div key={evidence.id} className="pixel-panel grid grid-cols-[96px_1fr] gap-3 bg-white p-3">
                            <div className="flex aspect-square items-center justify-center overflow-hidden border-2 border-[#151515] bg-white">
                              <SummaryEvidenceThumb evidence={evidence} />
                            </div>
                            <div className="min-w-0 self-center">
                              <p className="truncate text-lg font-black">{table?.table_name || "Mesa"}</p>
                              <p className="truncate text-sm text-[#151515]/65">{evidence.captain_name || table?.captain_name || "-"}</p>
                              <p className="mt-1 text-xs font-black uppercase text-[#151515]/70">
                                {evidence.evidence_type === "audio" ? "Audio" : evidence.evidence_type === "video" ? "Vídeo" : "Foto"}
                                {evidence.points_awarded ? ` · +${evidence.points_awarded} pts` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeSummarySlide.type === "closing" && (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <Crown className="mb-5 h-20 w-20 text-[#151515]" />
                  <h2 className="text-5xl font-black leading-none tracking-normal">Misión completada</h2>
                  <p className="mt-4 text-sm leading-6 text-[#151515]/65">Gracias por crear recuerdos con vuestra mesa.</p>
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-3 gap-2">
            <SecondaryButton onClick={() => setSummaryIndex((index) => Math.max(0, index - 1))}>Anterior</SecondaryButton>
            <GameButton className="min-h-12 py-3" onClick={() => setIsSummaryPlaying((value) => !value)}>
              {isSummaryPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {isSummaryPlaying ? "Pausa" : "Play"}
            </GameButton>
            <SecondaryButton onClick={() => setSummaryIndex((index) => (index + 1) % summarySlides.length)}>Siguiente</SecondaryButton>
          </div>
          <GameButton onClick={shareSummary}>
            <Share2 className="h-5 w-5" />
            {summaryCopied ? "URL copiada" : "Compartir resumen"}
          </GameButton>
          <SecondaryButton onClick={() => go("live")}>Volver a recuerdos</SecondaryButton>
        </div>
      </CaptainsShell>
    );
  }

  if (!liveEventAvailable || !liveEnabled) {
    return (
      <CaptainsShell>
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
      <CaptainsShell>
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
    <CaptainsShell>
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
          {(["all", "mine", "others", "photo", "video", "audio"] as EvidenceFilter[]).map((filter) => (
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
                  {evidence.evidence_type === "audio" && <Volume2 className="h-4 w-4" />}
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
