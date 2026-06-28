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
  <main className="min-h-[var(--app-height,100svh)] bg-[#101827] text-white">
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,0.35),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(251,113,133,0.32),transparent_26%),linear-gradient(160deg,#101827_0%,#16213f_48%,#241535_100%)]" />
    <div className="fixed inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:22px_22px]" />
    <div className="relative mx-auto flex min-h-[var(--app-height,100svh)] w-full max-w-[430px] flex-col px-4 py-5">
      {children}
    </div>
  </main>
);

const GameCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <section
    className={cn(
      "rounded-[8px] border-2 border-white/15 bg-white/[0.09] p-4 shadow-[0_18px_0_rgba(0,0,0,0.18)] backdrop-blur-xl",
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
      "h-13 min-h-12 w-full rounded-[8px] border-2 border-white/15 bg-[#2dd4bf] px-5 py-4 text-base font-black uppercase tracking-normal text-[#07131f] shadow-[0_6px_0_#0f766e] hover:bg-[#5eead4] active:translate-y-1 active:shadow-[0_2px_0_#0f766e]",
      className,
    )}
  />
);

const SecondaryButton = ({ className, ...props }: React.ComponentProps<typeof Button>) => (
  <Button
    {...props}
    variant="outline"
    className={cn(
      "h-12 w-full rounded-[8px] border-2 border-white/20 bg-white/10 text-sm font-bold text-white hover:bg-white/20 hover:text-white",
      className,
    )}
  />
);

const HeroBadge = ({ children }: { children: React.ReactNode }) => (
  <div className="inline-flex items-center gap-2 rounded-[8px] border border-[#facc15]/40 bg-[#facc15]/15 px-3 py-1 text-xs font-black uppercase tracking-normal text-[#fde68a]">
    <Sparkles className="h-3.5 w-3.5" />
    {children}
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
    <main className="flex min-h-[var(--app-height,100svh)] items-center justify-center bg-[#101827] px-6 text-white">
      <div className="max-w-md rounded-[8px] border border-white/15 bg-white/10 p-7 text-center shadow-2xl">
        <Shield className="mx-auto mb-4 h-11 w-11 text-[#2dd4bf]" />
        <h1 className="text-2xl font-black tracking-normal">
          Capitanes by Revelao está pensado para jugar desde el móvil.
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/75">
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
      <Loader2 className="h-8 w-8 animate-spin text-[#2dd4bf]" />
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
      <div className="flex aspect-[4/3] items-center justify-center rounded-[8px] bg-black/25 text-white/50">
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
            <XCircle className="mx-auto mb-3 h-10 w-10 text-[#fb7185]" />
            <h1 className="text-xl font-black">Misión no encontrada</h1>
            <p className="mt-2 text-sm text-white/70">Comprueba el QR o pide un nuevo enlace al equipo.</p>
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
            <HeroBadge>Nueva misión</HeroBadge>
            <h1 className="mt-4 text-5xl font-black leading-none tracking-normal">Capitanes by Revelao</h1>
            <p className="mt-3 text-xl font-bold text-[#5eead4]">La misión de las mesas ha comenzado</p>
          </div>
          <GameCard>
            <div className="flex items-start gap-3">
              <div className="rounded-[8px] bg-[#fb7185] p-3 shadow-[0_5px_0_#9f1239]">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <p className="text-sm leading-6 text-white/80">
                {event.description || "Reúne a tu mesa, supera retos y subid pruebas para conquistar el ranking."}
              </p>
            </div>
          </GameCard>
          <GameButton onClick={() => go("start")}>
            Empezar <ChevronRight className="h-5 w-5" />
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
            <HeroBadge>Identificación</HeroBadge>
            <h1 className="mt-4 text-4xl font-black tracking-normal">Elige tu mesa</h1>
            <p className="mt-2 text-sm leading-6 text-white/70">Selecciona tu mesa y capitán para empezar la misión.</p>
          </div>
          <div className="grid gap-3">
            {tables.map((table) => {
              const active = selectedTableId === table.id;
              return (
                <button
                  key={table.id}
                  onClick={() => handleTableSelect(table.id)}
                  className={cn(
                    "flex min-h-16 items-center justify-between rounded-[8px] border-2 p-4 text-left transition",
                    active ? "border-[#facc15] bg-[#facc15]/20" : "border-white/15 bg-white/10",
                  )}
                >
                  <span>
                    <span className="block text-base font-black">{table.table_name}</span>
                    <span className="text-sm text-white/65">
                      {table.captain_name ? table.captain_name : "Sin capitán asignado"}
                    </span>
                  </span>
                  {active ? <CheckCircle2 className="h-6 w-6 text-[#facc15]" /> : <Users className="h-5 w-5 text-white/45" />}
                </button>
              );
            })}
          </div>
          {requiresCaptainName && (
            <GameCard>
              <label className="text-xs font-black uppercase text-white/60">Nombre del capitán</label>
              <input
                value={captainNameInput}
                onChange={(event) => setCaptainNameInput(event.target.value)}
                className="mt-2 h-12 w-full rounded-[8px] border-2 border-white/15 bg-black/25 px-3 text-base font-bold outline-none focus:border-[#2dd4bf]"
                placeholder="Nombre del capitán"
              />
            </GameCard>
          )}
          {showActiveWarning && selectedTable && (
            <GameCard className="border-[#facc15]/50 bg-[#facc15]/10">
              <h2 className="font-black">Esta mesa ya tiene capitán activo.</h2>
              <p className="mt-1 text-sm leading-6 text-white/70">
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
              <Clock3 className="mx-auto mb-4 h-12 w-12 text-[#facc15]" />
              <h1 className="text-3xl font-black tracking-normal">La misión todavía no ha empezado</h1>
              <p className="mt-3 text-white/75">
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
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#2dd4bf]" />
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
          <GameCard className="bg-black/20">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-normal">{currentTable.table_name}</h1>
                <p className="text-sm text-white/65">Capitán: {session?.captain_name}</p>
              </div>
              <div className="rounded-[8px] bg-[#facc15] px-3 py-2 text-right text-[#111827] shadow-[0_4px_0_#a16207]">
                <div className="text-lg font-black">{totalPoints}</div>
                <div className="text-[10px] font-black uppercase">puntos</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex justify-between text-xs font-black uppercase text-white/60">
                <span>Reto {currentIndex} de {tableChallenges.length}</span>
                <span>{Math.round((completedRows.length / Math.max(tableChallenges.length, 1)) * 100)}%</span>
              </div>
              <Progress value={(completedRows.length / Math.max(tableChallenges.length, 1)) * 100} className="h-3 bg-black/30 [&>div]:bg-[#2dd4bf]" />
            </div>
          </GameCard>

          {phase === "intro" && (
            <GameCard className="animate-scale-in text-center">
              <Flame className="mx-auto mb-4 h-12 w-12 text-[#fb7185]" />
              <h2 className="text-3xl font-black tracking-normal">{currentTable.table_name}</h2>
              <p className="mt-2 text-sm font-bold text-white/70">Capitán: {session?.captain_name}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-left">
                <div className="rounded-[8px] bg-black/25 p-3">
                  <p className="text-2xl font-black">Reto {currentIndex}</p>
                  <p className="text-xs text-white/55">de {tableChallenges.length}</p>
                </div>
                <div className="rounded-[8px] bg-black/25 p-3">
                  <p className="text-2xl font-black text-[#facc15]">{totalPoints}</p>
                  <p className="text-xs text-white/55">puntos</p>
                </div>
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
                <span className="rounded-[8px] bg-[#fb7185] px-3 py-1 text-sm font-black">{currentChallenge.points} pts</span>
              </div>
              <h2 className="text-3xl font-black tracking-normal">{currentChallenge.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/75">{currentChallenge.description}</p>
              <div className="mt-4 grid gap-2 text-sm font-bold">
                <div className="flex items-center gap-2 rounded-[8px] bg-black/20 p-3">
                  <EvidenceIcon type={currentChallenge.evidence_type} className="h-5 w-5 text-[#5eead4]" />
                  Evidencia necesaria: {evidenceLabel[currentChallenge.evidence_type]}
                </div>
                <div className="flex items-center gap-2 rounded-[8px] bg-black/20 p-3">
                  <Medal className="h-5 w-5 text-[#facc15]" />
                  Puntos máximos: {currentChallenge.points}
                </div>
                {currentChallenge.has_time_limit && (
                  <div className="flex items-center gap-2 rounded-[8px] bg-black/20 p-3">
                    <Clock3 className="h-5 w-5 text-[#fb7185]" />
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
                  <div className="text-6xl font-black tracking-normal text-[#facc15]">{formatClock(remaining)}</div>
                  <p className="mt-1 text-sm font-bold text-white/65">Te quedan {remaining} segundos</p>
                  <Progress value={timePercent} className="mt-4 h-4 bg-black/30 [&>div]:bg-[#facc15]" />
                </div>
              )}
              <h2 className="text-2xl font-black tracking-normal">{currentChallenge.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">{currentChallenge.description}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={evidenceAccept[currentChallenge.evidence_type]}
                capture={evidenceCapture[currentChallenge.evidence_type]}
                className="hidden"
                onChange={onPickEvidence}
              />
              {evidencePreview && (
                <div className="mt-4 overflow-hidden rounded-[8px] border border-white/15 bg-black/20">
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
                  <GameButton disabled={busy} onClick={submitEvidence} className="bg-[#facc15] text-[#111827] shadow-[0_6px_0_#a16207] hover:bg-[#fde047]">
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
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[#2dd4bf]" />
                  <h2 className="text-3xl font-black tracking-normal">¡Prueba enviada!</h2>
                  <p className="mt-2 text-sm text-white/70">
                    {resultEvidence?.elapsed_seconds != null ? `Habéis tardado ${resultEvidence.elapsed_seconds} segundos.` : "Evidencia validada."}
                  </p>
                  <p className="mt-2 text-xl font-black text-[#facc15]">Sumáis {resultEvidence?.points_awarded || 0} puntos.</p>
                </>
              )}
              {resultKind === "manual" && (
                <>
                  <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-[#facc15]" />
                  <h2 className="text-3xl font-black tracking-normal">Prueba enviada</h2>
                  <p className="mt-2 text-sm text-white/70">El equipo revisará la evidencia y asignará la puntuación.</p>
                </>
              )}
              {resultKind === "failed" && (
                <>
                  <RotateCcw className="mx-auto mb-3 h-12 w-12 text-[#fb7185]" />
                  <h2 className="text-3xl font-black tracking-normal">Reto no conseguido</h2>
                  <p className="mt-2 text-sm text-white/70">Esta vez no suma puntos, pero todavía podéis remontar.</p>
                </>
              )}
              {resultKind === "expired" && (
                <>
                  <Clock3 className="mx-auto mb-3 h-12 w-12 text-[#fb7185]" />
                  <h2 className="text-3xl font-black tracking-normal">Tiempo agotado</h2>
                  <p className="mt-2 text-sm text-white/70">Esta misión se ha quedado sin tiempo. Podéis pasar a la siguiente.</p>
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
            <h1 className="mt-4 text-4xl font-black tracking-normal">Así va la competición</h1>
            <p className="mt-2 text-sm leading-6 text-[#5eead4]">{message}</p>
          </div>
          <div className="space-y-3">
            {ranking.map((item) => {
              const mine = item.id === session?.table_id;
              return (
                <GameCard key={item.id} className={cn("flex items-center gap-3 p-3", mine && "border-[#facc15] bg-[#facc15]/15")}>
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-[8px] font-black", mine ? "bg-[#facc15] text-[#111827]" : "bg-white/10")}>
                    {item.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">{item.table_name}</p>
                    <p className="truncate text-xs text-white/60">{item.active_captain_name || item.captain_name || "Sin capitán"}</p>
                    <p className="text-xs text-white/50">{item.completed_challenges} retos completados</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-[#facc15]">{item.total_points}</p>
                    <p className="text-[10px] font-black uppercase text-white/50">puntos</p>
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
            <Crown className="mx-auto mb-4 h-14 w-14 text-[#facc15]" />
            <h1 className="text-4xl font-black tracking-normal">Misión completada</h1>
            <p className="mt-3 text-sm leading-6 text-white/70">Habéis terminado todos los retos de {currentTable?.table_name || session?.table_name}.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-[8px] bg-black/25 p-3">
                <p className="text-2xl font-black">{completedRows.filter((row) => row.status === "completed" || row.status === "pending_review").length}</p>
                <p className="text-xs text-white/55">Retos completados</p>
              </div>
              <div className="rounded-[8px] bg-black/25 p-3">
                <p className="text-2xl font-black">{failedCount}</p>
                <p className="text-xs text-white/55">No conseguidos</p>
              </div>
              <div className="rounded-[8px] bg-black/25 p-3">
                <p className="text-2xl font-black text-[#facc15]">{totalPoints}</p>
                <p className="text-xs text-white/55">Puntos totales</p>
              </div>
              <div className="rounded-[8px] bg-black/25 p-3">
                <p className="text-2xl font-black">#{myRank?.rank || "-"}</p>
                <p className="text-xs text-white/55">Posición provisional</p>
              </div>
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
              <Film className="mx-auto mb-4 h-12 w-12 text-[#facc15]" />
              <h1 className="text-3xl font-black tracking-normal">El resumen todavía no está disponible.</h1>
              <p className="mt-2 text-sm leading-6 text-white/70">
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
            <p className="mt-2 text-sm leading-6 text-white/70">Un vídeo único con los retos y evidencias de las mesas.</p>
          </div>

          <section className="relative flex min-h-[520px] flex-1 overflow-hidden rounded-[8px] border-2 border-white/15 bg-black shadow-[0_18px_0_rgba(0,0,0,0.22)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(45,212,191,.25),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(251,113,133,.2),transparent_30%)]" />
            <div className="relative flex w-full flex-col p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs font-black uppercase text-white/55">
                <span>{activeSummarySlide.type === "cover" ? "Intro" : activeSummarySlide.type === "closing" ? "Final" : activeSummarySlide.title}</span>
                <span>{summaryIndex + 1}/{summarySlides.length}</span>
              </div>
              <Progress value={((summaryIndex + 1) / summarySlides.length) * 100} className="mb-4 h-2 bg-white/15 [&>div]:bg-[#facc15]" />

              {activeSummarySlide.type === "cover" && (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <Trophy className="mb-5 h-20 w-20 text-[#facc15]" />
                  <h2 className="text-5xl font-black leading-none tracking-normal">{event.name}</h2>
                  <p className="mt-4 text-lg font-bold text-[#5eead4]">Capitanes by Revelao</p>
                  <p className="mt-2 text-sm text-white/55">{summaryEvidence.length} recuerdos en el montaje</p>
                </div>
              )}

              {activeSummarySlide.type === "challenge" && (
                <div className="flex flex-1 flex-col">
                  <h2 className="text-3xl font-black tracking-normal">{activeSummarySlide.title}</h2>
                  {activeSummarySlide.evidences.length === 0 ? (
                    <div className="mt-5 flex flex-1 items-center justify-center rounded-[8px] bg-white/10 text-center">
                      <p className="px-6 text-sm font-bold text-white/60">Todavía no hay evidencias para este reto.</p>
                    </div>
                  ) : (
                    <div className="mt-4 grid flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-hidden">
                      {activeSummarySlide.evidences.slice(0, 3).map((evidence) => {
                        const table = tableById.get(evidence.table_id);
                        return (
                          <div key={evidence.id} className="grid grid-cols-[96px_1fr] gap-3 rounded-[8px] bg-white/10 p-3">
                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[8px] bg-black/35">
                              {evidence.file_url && evidence.evidence_type !== "audio" ? (
                                <img src={evidence.file_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <EvidenceIcon type={evidence.evidence_type} className="h-10 w-10 text-[#5eead4]" />
                              )}
                            </div>
                            <div className="min-w-0 self-center">
                              <p className="truncate text-lg font-black">{table?.table_name || "Mesa"}</p>
                              <p className="truncate text-sm text-white/65">{evidence.captain_name || table?.captain_name || "-"}</p>
                              <p className="mt-1 text-xs font-black uppercase text-[#facc15]">
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
                  <Crown className="mb-5 h-20 w-20 text-[#facc15]" />
                  <h2 className="text-5xl font-black leading-none tracking-normal">Misión completada</h2>
                  <p className="mt-4 text-sm leading-6 text-white/65">Gracias por crear recuerdos con vuestra mesa.</p>
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
          <GameCard className="border-[#facc15]/50 bg-[#facc15]/10 text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-[#facc15]" />
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
          <GameCard className="border-[#facc15]/50 bg-[#facc15]/10 text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-[#facc15]" />
            <h1 className="text-3xl font-black tracking-normal">Todavía quedan misiones por completar.</h1>
            <p className="mt-2 text-sm leading-6 text-white/70">
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
          <p className="mt-2 text-sm leading-6 text-white/70">Mira lo que están creando el resto de mesas en tiempo real.</p>
        </div>
        <GameCard className="grid grid-cols-2 gap-3 bg-black/20 text-sm">
          <div className="col-span-2">
            <p className="text-xs font-black uppercase text-white/45">Evento</p>
            <p className="truncate text-base font-black">{event.name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-white/45">Mesa</p>
            <p className="font-bold">{currentTable?.table_name || session?.table_name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-white/45">Capitán</p>
            <p className="truncate font-bold">{session?.captain_name}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-white/45">Posición</p>
            <p className="text-xl font-black text-[#facc15]">#{myRank?.rank || "-"}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-white/45">Puntos</p>
            <p className="text-xl font-black text-[#5eead4]">{totalPoints}</p>
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
                "min-h-10 rounded-[8px] border border-white/15 px-2 text-xs font-black",
                liveFilter === filter ? "bg-[#2dd4bf] text-[#07131f]" : "bg-white/10 text-white",
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
        {isRefreshingLive && <p className="text-center text-xs font-bold text-[#5eead4]">Actualizando recuerdos...</p>}
        {newMemoriesAvailable && (
          <button
            type="button"
            onClick={() => setNewMemoriesAvailable(false)}
            className="w-full rounded-[8px] border border-[#2dd4bf]/40 bg-[#2dd4bf]/15 px-3 py-2 text-xs font-black text-[#99f6e4]"
          >
            Nuevos recuerdos disponibles
          </button>
        )}
        {lastRefresh && <p className="text-center text-xs text-white/45">Actualizado a las {lastRefresh.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>}
        {liveError && (
          <GameCard className="border-[#fb7185]/40 bg-[#fb7185]/10 text-center">
            <p className="font-black">{liveError}</p>
          </GameCard>
        )}
        {filteredEvidence.length === 0 && (
          <GameCard className="text-center">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 text-white/45" />
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
                    <p className="truncate text-xs text-white/60">Capitán: {evidence.captain_name || table?.active_captain_name || table?.captain_name || "-"}</p>
                    <p className="mt-1 text-sm font-bold text-[#5eead4]">Reto: {challenge?.title || "Reto"}</p>
                  </div>
                  <div className="shrink-0 rounded-[8px] bg-black/25 px-2 py-1 text-xs font-black">
                    {evidenceLabel[evidence.evidence_type]}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/55">
                  <span>{formatRelativeTime(evidence.created_at)}</span>
                  {evidence.status === "pending_review" && <span className="rounded-[8px] bg-[#facc15]/20 px-2 py-1 font-black text-[#fde68a]">Pendiente de revisión</span>}
                  {evidence.status === "approved" && evidence.points_awarded > 0 && (
                    <span className="rounded-[8px] bg-[#2dd4bf]/20 px-2 py-1 font-black text-[#99f6e4]">+{evidence.points_awarded} puntos</span>
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
