import { supabase } from "@/integrations/supabase/client";
import { supabasePublic } from "@/integrations/supabase/publicClient";
import { captainsDefaultChallengeCatalog } from "@/lib/captainsDefaultChallengeCatalog";
import { getSignedUrlCached } from "@/lib/signedUrlCache";
import { compressImage } from "@/lib/imageCompression";
import { Upload } from "tus-js-client";
import {
  calculateCaptainsAutomaticScore,
  getCaptainsPublicUrl,
  getCaptainsQrImageUrl,
  sanitizeCaptainsFileName,
  shuffleCaptainsItems,
  slugifyCaptainsValue,
} from "@/lib/captainsUtils";
import type {
  CaptainsChallengeCatalogItem,
  CaptainsChallengeInput,
  CaptainsEvent,
  CaptainsEventChallenge,
  CaptainsEventDetail,
  CaptainsEventListItem,
  CaptainsEvidence,
  CaptainsEvidenceIndexItem,
  CaptainsEvidenceStatus,
  CaptainsRankingItem,
  CaptainsTable,
  CaptainsTableChallenge,
  CaptainsTableChallengeStatus,
  CaptainsThemeStyle,
  CreateCaptainsEventInput,
  CaptainsScoringMode,
  CaptainsSpriteConfig,
  CaptainsSpriteStyle,
} from "@/lib/captainsTypes";

// Several deployed Captains columns predate the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdb = supabasePublic as any;
const CAPTAINS_EVIDENCE_BUCKET = "captains-evidence";
const CAPTAINS_RESUMABLE_THRESHOLD = 6 * 1024 * 1024;
export const CAPTAINS_MAX_CHALLENGES = 25;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const ensureNoError = (error: unknown) => {
  if (error) throw error;
};

const ensureCaptainsChallengeLimit = (count: number) => {
  if (count > CAPTAINS_MAX_CHALLENGES) {
    throw new Error(`El máximo por evento es de ${CAPTAINS_MAX_CHALLENGES} retos.`);
  }
};

const ensureCaptainsEventIsOpen = async (eventId: string) => {
  const { data, error } = await pdb.from("captains_events").select("end_time,status").eq("id", eventId).single();
  ensureNoError(error);
  const endedByDate = data?.end_time && new Date(data.end_time).getTime() <= Date.now();
  if (data?.status === "finished" || endedByDate) {
    throw new Error("El juego ha finalizado y ya no admite nuevos retos completados.");
  }
};

const uploadCaptainsEvidenceFile = async (
  filePath: string,
  file: File,
  onProgress?: (percentage: number) => void,
) => {
  const readableUploadError = (cause: unknown) => {
    const message = cause instanceof Error ? cause.message : String(cause || "");
    const status = typeof cause === "object" && cause && "originalResponse" in cause
      ? (cause as { originalResponse?: { getStatus?: () => number } }).originalResponse?.getStatus?.()
      : typeof cause === "object" && cause && "statusCode" in cause
        ? Number((cause as { statusCode?: unknown }).statusCode)
        : null;
    if (/413|too large|maximum|exceed|payload/i.test(message)) {
      return new Error("El archivo supera el tamaño admitido. Graba un vídeo más corto y vuelve a intentarlo.");
    }
    if (status === 401 || status === 403 || /row-level security|unauthorized|forbidden/i.test(message)) {
      return new Error("La partida no permite guardar este archivo. Actualiza la pantalla y vuelve a entrar en el reto.");
    }
    if (/network|fetch|offline|internet|connection/i.test(message)) {
      return new Error("Se ha perdido la conexión durante la subida. Conservamos el archivo para que puedas pulsar Enviar de nuevo.");
    }
    console.error("Captains evidence upload failed:", cause);
    return new Error("La subida se ha interrumpido. Mantendremos el archivo para que puedas pulsar Enviar de nuevo.");
  };
  onProgress?.(0);
  if (file.size <= CAPTAINS_RESUMABLE_THRESHOLD) {
    const { error } = await supabasePublic.storage.from(CAPTAINS_EVIDENCE_BUCKET).upload(filePath, file);
    if (error) throw readableUploadError(error);
    onProgress?.(100);
    return;
  }

  const supabaseUrl = new URL(import.meta.env.VITE_SUPABASE_URL);
  const directHostname = supabaseUrl.hostname.endsWith(".supabase.co")
    ? `${supabaseUrl.hostname.split(".")[0]}.storage.supabase.co`
    : supabaseUrl.host;
  const endpoint = `${supabaseUrl.protocol}//${directHostname}/storage/v1/upload/resumable`;
  const authorization = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: { authorization, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: CAPTAINS_RESUMABLE_THRESHOLD,
      metadata: {
        bucketName: CAPTAINS_EVIDENCE_BUCKET,
        objectName: filePath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      fingerprint: () => Promise.resolve(`${CAPTAINS_EVIDENCE_BUCKET}/${filePath}`),
      onProgress: (uploaded, total) => onProgress?.(total > 0 ? Math.round((uploaded / total) * 100) : 0),
      onError: cause => reject(readableUploadError(cause)),
      onSuccess: () => { onProgress?.(100); resolve(); },
    });
    void upload.findPreviousUploads().then(previous => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(reject);
  });
};

const getCaptainsEvidenceStoragePath = (value?: string | null) => {
  const rawValue = value?.trim();
  if (!rawValue) return null;
  const bucketPrefix = `${CAPTAINS_EVIDENCE_BUCKET}/`;

  if (!/^https?:\/\//i.test(rawValue)) {
    return rawValue.replace(/^\/+/, "").replace(new RegExp(`^${bucketPrefix}`), "");
  }

  try {
    const pathname = decodeURIComponent(new URL(rawValue).pathname);
    const markers = [
      `/storage/v1/object/public/${bucketPrefix}`,
      `/storage/v1/object/sign/${bucketPrefix}`,
      `/storage/v1/object/${bucketPrefix}`,
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    return marker ? pathname.slice(pathname.indexOf(marker) + marker.length) : null;
  } catch {
    return null;
  }
};

const captainThemeColumns = [
  "primary_color",
  "secondary_color",
  "background_image_url",
  "theme_style",
  "contact_name",
  "contact_email",
  "contact_phone",
  "experience_version",
];

const withoutCaptainThemeColumns = <T extends Record<string, unknown>>(payload: T) => {
  const next = { ...payload };
  captainThemeColumns.forEach((column) => delete next[column]);
  return next;
};

const isMissingCaptainThemeColumnError = (error: unknown) => {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return captainThemeColumns.some((column) => message.includes(column));
};

const captainTableVisualColumns = ["captain_sprite", "captain_sprite_config", "captain_photo_url"];

const withoutCaptainTableVisualColumns = <T extends Record<string, unknown>>(payload: T) => {
  const next = { ...payload };
  captainTableVisualColumns.forEach((column) => delete next[column]);
  return next;
};

const isMissingCaptainTableVisualColumnError = (error: unknown) => {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return captainTableVisualColumns.some((column) => message.includes(column));
};

const captainQuestionColumns = ["question_options", "question_correct_option"];

const withoutCaptainQuestionColumns = <T extends Record<string, unknown>>(payload: T) => {
  const next = { ...payload };
  captainQuestionColumns.forEach((column) => delete next[column]);
  return next;
};

const isMissingCaptainQuestionColumnError = (error: unknown) => {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return captainQuestionColumns.some((column) => message.includes(column));
};

const normalizeChallengeRow = (challenge: CaptainsChallengeInput, index: number, eventId: string) => ({
  event_id: eventId,
  catalog_challenge_id: challenge.catalog_challenge_id ?? null,
  title: challenge.title,
  description: challenge.description,
  evidence_type: challenge.evidence_type,
  points: challenge.points,
  category: challenge.category,
  difficulty: challenge.difficulty,
  has_time_limit: challenge.has_time_limit ?? false,
  time_limit_seconds: challenge.has_time_limit ? challenge.time_limit_seconds ?? null : null,
  question_options: challenge.evidence_type === "question" ? challenge.question_options ?? [] : null,
  question_correct_option: challenge.evidence_type === "question" ? challenge.question_correct_option ?? null : null,
  order_index: challenge.order_index ?? index + 1,
  is_required: challenge.is_required ?? false,
});

const audioToVideoText = (value?: string | null) =>
  (value || "")
    .replace(/Grabad un audio/g, "Grabad un vídeo")
    .replace(/grabe un audio/g, "grabe un vídeo")
    .replace(/un audio/g, "un vídeo")
    .replace(/en audio/g, "en vídeo")
    .replace(/audio/g, "vídeo")
    .replace(/Audio/g, "Vídeo");

const sanitizeCaptainsCatalogItem = (item: CaptainsChallengeCatalogItem): CaptainsChallengeCatalogItem => {
  if ((item.evidence_type as string) !== "audio") return item;
  return {
    ...item,
    title: audioToVideoText(item.title),
    description: audioToVideoText(item.description),
    evidence_type: "video",
    category: item.category === "Audio" ? "Vídeo" : item.category,
  };
};

const sanitizeCaptainsEventChallenge = (item: CaptainsEventChallenge): CaptainsEventChallenge => {
  if ((item.evidence_type as string) !== "audio") return item;
  return {
    ...item,
    title: audioToVideoText(item.title),
    description: audioToVideoText(item.description),
    evidence_type: "video",
    category: item.category === "Audio" ? "Vídeo" : item.category,
  };
};

export const listCaptainsEvents = async () => {
  const { data, error } = await db
    .from("captains_events")
    .select("*")
    .order("created_at", { ascending: false });
  ensureNoError(error);

  const events = (data || []) as CaptainsEvent[];
  if (events.length === 0) return [] as CaptainsEventListItem[];

  const eventIds = events.map((event) => event.id);
  const [tablesRes, challengesRes] = await Promise.all([
    db.from("captains_tables").select("event_id").in("event_id", eventIds),
    db.from("captains_event_challenges").select("event_id").in("event_id", eventIds),
  ]);
  const tableCounts = new Map<string, number>();
  const challengeCounts = new Map<string, number>();
  for (const row of tablesRes.data || []) {
    tableCounts.set(row.event_id, (tableCounts.get(row.event_id) || 0) + 1);
  }
  for (const row of challengesRes.data || []) {
    challengeCounts.set(row.event_id, (challengeCounts.get(row.event_id) || 0) + 1);
  }

  const enriched = events.map((event) => ({
    ...event,
    table_count: tablesRes.error ? 0 : tableCounts.get(event.id) || 0,
    challenge_count: challengesRes.error ? 0 : challengeCounts.get(event.id) || 0,
  } as CaptainsEventListItem));

  return enriched;
};

export const generateUniqueCaptainsSlug = async (base: string, excludeEventId?: string) => {
  const cleanBase = slugifyCaptainsValue(base);
  let candidate = cleanBase;
  let suffix = 2;

  while (true) {
    let query = db.from("captains_events").select("id").eq("slug", candidate).maybeSingle();
    if (excludeEventId) {
      query = query.neq("id", excludeEventId);
    }
    const { data, error } = await query;
    ensureNoError(error);
    if (!data) return candidate;
    candidate = `${cleanBase}-${suffix}`;
    suffix += 1;
  }
};

export const createCaptainsEvent = async (input: CreateCaptainsEventInput) => {
  const slug = await generateUniqueCaptainsSlug(input.slug || input.name);
  const publicUrl = getCaptainsPublicUrl(slug);
  const payload = {
    name: input.name,
    slug,
    description: input.description ?? null,
    start_time: input.start_time ?? new Date().toISOString(),
    end_time: input.end_time ?? null,
    scoring_mode: "automatic",
    status: "active",
    show_live_gallery_after_completion: true,
    theme_style: "pixel" as CaptainsThemeStyle,
    experience_version: input.experience_version ?? "v2",
    primary_color: "#f06a5f",
    secondary_color: "#2f292d",
    background_image_url: null,
    contact_name: input.contact_name?.trim() || null,
    contact_email: input.contact_email?.trim().toLowerCase() || null,
    contact_phone: input.contact_phone?.trim() || null,
    public_url: publicUrl,
    qr_url: getCaptainsQrImageUrl(publicUrl),
  };

  const { data, error } = await db.from("captains_events").insert(payload).select("*").single();
  if (!error) return data as CaptainsEvent;

  if (isMissingCaptainThemeColumnError(error)) {
    const fallback = await db.from("captains_events").insert(withoutCaptainThemeColumns(payload)).select("*").single();
    ensureNoError(fallback.error);
    return fallback.data as CaptainsEvent;
  }

  ensureNoError(error);
  return data as CaptainsEvent;
};

export const createCaptainsGame = async ({
  event,
  tables,
  challenges,
}: {
  event: CreateCaptainsEventInput;
  tables: Array<{
    table_number: number;
    table_name?: string;
    captain_name?: string | null;
    captain_photo_url?: string | null;
    captain_sprite?: CaptainsSpriteStyle | null;
    captain_sprite_config?: CaptainsSpriteConfig | null;
  }>;
  challenges: CaptainsChallengeInput[];
}) => {
  ensureCaptainsChallengeLimit(challenges.length);
  const createdEvent = await createCaptainsEvent(event);

  if (tables.length > 0) {
    const tableRows = tables.map((table) => ({
      event_id: createdEvent.id,
      table_number: table.table_number,
      table_name: table.table_name?.trim() || `Mesa ${table.table_number}`,
      captain_name: table.captain_name?.trim() || null,
      active_captain_name: table.captain_name?.trim() || null,
      captain_photo_url: table.captain_photo_url?.trim() || null,
      captain_sprite: table.captain_sprite ?? null,
      captain_sprite_config: table.captain_sprite_config ?? null,
    }));
    const { error } = await db.from("captains_tables").insert(tableRows);
    if (error && isMissingCaptainTableVisualColumnError(error)) {
      const fallback = await db.from("captains_tables").insert(tableRows.map(withoutCaptainTableVisualColumns));
      ensureNoError(fallback.error);
    } else {
      ensureNoError(error);
    }
  }

  if (challenges.length > 0) {
    const challengeRows = challenges.map((challenge, index) => normalizeChallengeRow(challenge, index, createdEvent.id));
    const { error } = await db.from("captains_event_challenges").insert(challengeRows);
    if (error && isMissingCaptainQuestionColumnError(error)) {
      const fallback = await db.from("captains_event_challenges").insert(challengeRows.map(withoutCaptainQuestionColumns));
      ensureNoError(fallback.error);
    } else {
      ensureNoError(error);
    }
  }

  await generateRandomChallengeOrderForEvent(createdEvent.id);
  return getCaptainsEventDetail(createdEvent.id);
};

export const updateCaptainsEvent = async (
  eventId: string,
  input: Partial<CreateCaptainsEventInput & Pick<CaptainsEvent, "status" | "qr_url" | "public_url">>,
) => {
  const payload: Record<string, unknown> = { ...input };

  if (input.slug) {
    const slug = await generateUniqueCaptainsSlug(input.slug, eventId);
    payload.slug = slug;
    payload.public_url = input.public_url || getCaptainsPublicUrl(slug);
    payload.qr_url = input.qr_url || getCaptainsQrImageUrl(String(payload.public_url));
  }

  const { data, error } = await db.from("captains_events").update(payload).eq("id", eventId).select("*").single();
  if (!error) return data as CaptainsEvent;

  if (isMissingCaptainThemeColumnError(error)) {
    const fallback = await db.from("captains_events").update(withoutCaptainThemeColumns(payload)).eq("id", eventId).select("*").single();
    ensureNoError(fallback.error);
    return fallback.data as CaptainsEvent;
  }

  ensureNoError(error);
  return data as CaptainsEvent;
};

export const updateCaptainsTables = async (
  eventId: string,
  tables: Array<{
    id?: string;
    table_number: number;
    table_name?: string;
    captain_name?: string | null;
    captain_photo_url?: string | null;
    captain_sprite?: CaptainsSpriteStyle | null;
    captain_sprite_config?: CaptainsSpriteConfig | null;
  }>,
) => {
  const { data: existingTables, error: existingError } = await db
    .from("captains_tables")
    .select("id")
    .eq("event_id", eventId);
  ensureNoError(existingError);

  const keepIds = new Set(tables.map((table) => table.id).filter(Boolean));
  const deleteIds = ((existingTables || []) as Array<{ id: string }>)
    .map((table) => table.id)
    .filter((id) => !keepIds.has(id));

  if (deleteIds.length > 0) {
    const { error } = await db.from("captains_tables").delete().in("id", deleteIds);
    ensureNoError(error);
  }

  if (tables.length === 0) return [] as CaptainsTable[];

  const rows = tables.map((table) => ({
    id: table.id,
    event_id: eventId,
    table_number: table.table_number,
    table_name: table.table_name?.trim() || `Mesa ${table.table_number}`,
    captain_name: table.captain_name?.trim() || null,
    active_captain_name: table.captain_name?.trim() || null,
    captain_photo_url: table.captain_photo_url?.trim() || null,
    captain_sprite: table.captain_sprite ?? null,
    captain_sprite_config: table.captain_sprite_config ?? null,
  }));
  const { data, error } = await db
    .from("captains_tables")
    .upsert(rows, { onConflict: "id" })
    .select("*")
    .order("table_number", { ascending: true });
  if (error && isMissingCaptainTableVisualColumnError(error)) {
    const fallback = await db
      .from("captains_tables")
      .upsert(rows.map(withoutCaptainTableVisualColumns), { onConflict: "id" })
      .select("*")
      .order("table_number", { ascending: true });
    ensureNoError(fallback.error);
    return (fallback.data || []) as CaptainsTable[];
  }
  ensureNoError(error);
  return (data || []) as CaptainsTable[];
};

export const updateCaptainsTable = async (
  tableId: string,
  input: Partial<Pick<CaptainsTable, "table_name" | "captain_name" | "active_captain_name" | "captain_photo_url" | "captain_sprite" | "captain_sprite_config">>,
) => {
  const payload = {
    ...input,
    active_captain_name: input.active_captain_name ?? input.captain_name,
  };
  const { data, error } = await db.from("captains_tables").update(payload).eq("id", tableId).select("*").single();
  ensureNoError(error);
  return data as CaptainsTable;
};

export const resetCaptainsTableLastActivity = async (tableId: string, accessCode?: string) => {
  const functionClient = accessCode ? supabasePublic : supabase;
  const { data, error } = await functionClient.functions.invoke("reset-captains-tables", {
    body: { action: "table", tableId, accessCode: accessCode || null },
  });
  ensureNoError(error || data?.error);
  return data;
};

export const resetAllCaptainsTables = async (eventId: string, accessCode?: string) => {
  const functionClient = accessCode ? supabasePublic : supabase;
  const { data, error } = await functionClient.functions.invoke("reset-captains-tables", {
    body: { action: "all", eventId, accessCode: accessCode || null },
  });
  ensureNoError(error || data?.error);
  return data;
};

export const updateCaptainsEventChallenge = async (challengeId: string, input: CaptainsChallengeInput) => {
  const payload = normalizeChallengeRow(input, Math.max((input.order_index ?? 1) - 1, 0), input.id || "");
  delete (payload as Record<string, unknown>).event_id;
  const { data, error } = await db.from("captains_event_challenges").update(payload).eq("id", challengeId).select("*").single();
  if (error && isMissingCaptainQuestionColumnError(error)) {
    const fallback = await db
      .from("captains_event_challenges")
      .update(withoutCaptainQuestionColumns(payload))
      .eq("id", challengeId)
      .select("*")
      .single();
    ensureNoError(fallback.error);
    return fallback.data as CaptainsEventChallenge;
  }
  ensureNoError(error);
  return data as CaptainsEventChallenge;
};

export const deleteCaptainsEventChallenge = async (challengeId: string, fallbackEventId?: string) => {
  const { data: challenge, error: challengeError } = await db
    .from("captains_event_challenges")
    .select("id,event_id")
    .eq("id", challengeId)
    .maybeSingle();
  ensureNoError(challengeError);

  // Deleting a challenge is intentionally idempotent. A previous request may
  // already have removed it while the browser still has the stale row cached.
  if (!challenge) {
    if (!fallbackEventId) throw new Error("El reto ya no existe.");
    return fallbackEventId;
  }

  const { data: tableChallenges, error: tableChallengesError } = await db
    .from("captains_table_challenges")
    .select("id")
    .eq("challenge_id", challengeId);
  ensureNoError(tableChallengesError);

  const tableChallengeIds = (tableChallenges || []).map((row: { id: string }) => row.id);
  if (tableChallengeIds.length > 0) {
    const { data: evidence, error: evidenceError } = await db
      .from("captains_evidence")
      .select("id,file_url")
      .in("table_challenge_id", tableChallengeIds);
    ensureNoError(evidenceError);

    const storagePaths = Array.from(new Set(
      (evidence || [])
        .map((item: { file_url?: string | null }) => getCaptainsEvidenceStoragePath(item.file_url))
        .filter(Boolean) as string[],
    ));
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(CAPTAINS_EVIDENCE_BUCKET).remove(storagePaths);
      ensureNoError(storageError);
    }

    const evidenceIds = (evidence || []).map((item: { id: string }) => item.id);
    if (evidenceIds.length > 0) {
      const { error: deleteEvidenceError } = await db.from("captains_evidence").delete().in("id", evidenceIds);
      ensureNoError(deleteEvidenceError);
    }
  }

  const { error: deleteError } = await db.from("captains_event_challenges").delete().eq("id", challengeId);
  ensureNoError(deleteError);
  await recalculateCaptainsRanking(challenge.event_id);
  return challenge.event_id as string;
};

export const deleteCaptainsEvent = async (eventId: string) => {
  const evidence = await db.from("captains_evidence").delete().eq("event_id", eventId);
  ensureNoError(evidence.error);
  const tableChallenges = await db.from("captains_table_challenges").delete().eq("event_id", eventId);
  ensureNoError(tableChallenges.error);
  const eventChallenges = await db.from("captains_event_challenges").delete().eq("event_id", eventId);
  ensureNoError(eventChallenges.error);
  const tables = await db.from("captains_tables").delete().eq("event_id", eventId);
  ensureNoError(tables.error);
  const event = await db.from("captains_events").delete().eq("id", eventId);
  ensureNoError(event.error);
};

export const replaceCaptainsEventChallenges = async (eventId: string, challenges: CaptainsChallengeInput[]) => {
  ensureCaptainsChallengeLimit(challenges.length);
  const { error: deleteError } = await db.from("captains_event_challenges").delete().eq("event_id", eventId);
  ensureNoError(deleteError);

  if (challenges.length === 0) return [] as CaptainsEventChallenge[];

  const rows = challenges.map((challenge, index) => normalizeChallengeRow(challenge, index, eventId));
  const { data, error } = await db.from("captains_event_challenges").insert(rows).select("*");
  if (error && isMissingCaptainQuestionColumnError(error)) {
    const fallback = await db.from("captains_event_challenges").insert(rows.map(withoutCaptainQuestionColumns)).select("*");
    ensureNoError(fallback.error);
    await db.from("captains_table_challenges").delete().eq("event_id", eventId);
    await generateRandomChallengeOrderForEvent(eventId);
    return (fallback.data || []) as CaptainsEventChallenge[];
  }
  ensureNoError(error);
  await db.from("captains_table_challenges").delete().eq("event_id", eventId);
  await generateRandomChallengeOrderForEvent(eventId);
  return (data || []) as CaptainsEventChallenge[];
};

export const finishCaptainsEvent = async (eventId: string) =>
  updateCaptainsEvent(eventId, { status: "finished" });

export const getCaptainsEventDetail = async (identifier: string): Promise<CaptainsEventDetail | null> => {
  const eventQuery = pdb.from("captains_events").select("*").limit(1);
  const { data: event, error: eventError } = isUuid(identifier)
    ? await eventQuery.eq("id", identifier).maybeSingle()
    : await eventQuery.eq("slug", identifier).maybeSingle();
  ensureNoError(eventError);
  if (!event) return null;

  const [tablesRes, challengesRes] = await Promise.all([
    pdb.from("captains_tables").select("*").eq("event_id", event.id).order("table_number", { ascending: true }),
    pdb.from("captains_event_challenges").select("*").eq("event_id", event.id).order("order_index", { ascending: true }),
  ]);
  ensureNoError(tablesRes.error);
  ensureNoError(challengesRes.error);

  return {
    event: event as CaptainsEvent,
    tables: (tablesRes.data || []) as CaptainsTable[],
    challenges: ((challengesRes.data || []) as CaptainsEventChallenge[]).map(sanitizeCaptainsEventChallenge),
  };
};

export const createCaptainsTables = async (
  eventId: string,
  tableCount: number,
  options?: { tableNamePrefix?: string },
) => {
  const count = Math.max(0, Math.floor(tableCount));
  const prefix = options?.tableNamePrefix || "Mesa";
  const rows = Array.from({ length: count }, (_, index) => ({
    event_id: eventId,
    table_number: index + 1,
    table_name: `${prefix} ${index + 1}`,
  }));

  if (rows.length === 0) return [];

  const { data, error } = await db
    .from("captains_tables")
    .upsert(rows, { onConflict: "event_id,table_number" })
    .select("*")
    .order("table_number", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTable[];
};

export const getCaptainsTableChallenges = async (eventId: string) => {
  const { data, error } = await pdb
    .from("captains_table_challenges")
    .select("*")
    .eq("event_id", eventId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTableChallenge[];
};

export const getCaptainsTableChallengesForTable = async (eventId: string, tableId: string) => {
  const { data, error } = await pdb
    .from("captains_table_challenges")
    .select("*")
    .eq("event_id", eventId)
    .eq("table_id", tableId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTableChallenge[];
};

export const getCaptainsEvidenceSignedUrl = async (filePath: string) => {
  const signedUrl = await getSignedUrlCached({
    bucket: CAPTAINS_EVIDENCE_BUCKET,
    path: filePath,
    expiresInSeconds: 3600,
    clientScope: "public",
  });
  if (!signedUrl) throw new Error("Unable to create evidence signed URL");
  return signedUrl;
};

export const getCaptainsEvidenceThumbnailPath = (evidence: Pick<CaptainsEvidence, "evidence_type" | "file_url" | "thumbnail_url">) => {
  if (evidence.thumbnail_url) return evidence.thumbnail_url;
  if (evidence.evidence_type === "question") return null;
  // Thumbnails share the media directory and upload UUID. This convention
  // works on existing deployments without a captains_evidence.thumbnail_url column.
  const path = getCaptainsEvidenceStoragePath(evidence.file_url);
  const match = path?.match(/^(.*\/)([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})-/i);
  return match ? `${match[1]}${match[2]}-thumbnail.jpg` : null;
};

export const saveCaptainForTable = async (tableId: string, captainName: string) => {
  const cleanName = captainName.trim();
  const { data: existingTable, error: readError } = await pdb
    .from("captains_tables")
    .select("*")
    .eq("id", tableId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existingTable) throw new Error("No hemos podido encontrar la mesa seleccionada.");
  const lastActivityAt = new Date().toISOString();
  const { error } = await pdb
    .from("captains_tables")
    .update({
      captain_name: cleanName,
      active_captain_name: cleanName,
      last_activity_at: lastActivityAt,
    })
    .eq("id", tableId);
  ensureNoError(error);
  return {
    ...(existingTable as CaptainsTable),
    captain_name: cleanName,
    active_captain_name: cleanName,
    last_activity_at: lastActivityAt,
  } as CaptainsTable;
};

export const selectCaptainsTableSession = async (tableId: string, captainName: string) => {
  const cleanName = captainName.trim();
  const selectedAt = new Date().toISOString();
  const { data: existingTable, error: readError } = await pdb
    .from("captains_tables")
    .select("*")
    .eq("id", tableId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existingTable) throw new Error("No hemos podido encontrar la mesa seleccionada.");

  const { error } = await pdb
    .from("captains_tables")
    .update({
      captain_name: cleanName,
      active_captain_name: cleanName,
      last_activity_at: selectedAt,
    })
    .eq("id", tableId);
  ensureNoError(error);

  const table = {
    ...(existingTable as CaptainsTable),
    captain_name: cleanName,
    active_captain_name: cleanName,
    last_activity_at: selectedAt,
  };
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const deviceInfo =
    typeof window === "undefined"
      ? null
      : {
          width: window.innerWidth,
          height: window.innerHeight,
          platform: navigator.platform,
          language: navigator.language,
        };

  const { error: accessError } = await pdb.from("captains_table_accesses").insert({
    event_id: table.event_id,
    table_id: tableId,
    table_name: table.table_name,
    captain_name: cleanName,
    session_token: table.session_token,
    selected_at: selectedAt,
    user_agent: userAgent || null,
    device_info: deviceInfo,
  });
  if (accessError) console.warn("Could not log captains table access:", accessError);

  return {
    table,
    selected_at: selectedAt,
    user_agent: userAgent,
    device_info: deviceInfo,
  };
};

export const getCaptainsChallengeCatalog = async (activeOnly = true) => {
  let query = pdb
    .from("captains_challenge_catalog")
    .select("*")
    .order("category", { ascending: true })
    .order("default_points", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.warn("Using local captains challenge catalog fallback:", error);
    return captainsDefaultChallengeCatalog;
  }
  const catalog = ((data || []) as CaptainsChallengeCatalogItem[]).map(sanitizeCaptainsCatalogItem);
  return catalog.length > 0 ? catalog : captainsDefaultChallengeCatalog;
};

const appendCaptainsChallengesToTables = async (eventId: string, challenges: CaptainsEventChallenge[]) => {
  if (challenges.length === 0) return;
  const [{ data: tables, error: tablesError }, { data: existingRows, error: rowsError }] = await Promise.all([
    pdb.from("captains_tables").select("id").eq("event_id", eventId),
    pdb.from("captains_table_challenges").select("table_id,randomized_order_index,status").eq("event_id", eventId),
  ]);
  ensureNoError(tablesError);
  ensureNoError(rowsError);

  const rows = ((tables || []) as Array<{ id: string }>).flatMap((table) => {
    const current = ((existingRows || []) as Array<Pick<CaptainsTableChallenge, "table_id" | "randomized_order_index" | "status">>)
      .filter((row) => row.table_id === table.id);
    const startIndex = current.reduce((maximum, row) => Math.max(maximum, row.randomized_order_index), 0);
    const hasOpenChallenge = current.some((row) => ["pending", "ready", "in_progress", "submitted", "pending_review"].includes(row.status));
    return challenges.map((challenge, index) => ({
      event_id: eventId,
      table_id: table.id,
      challenge_id: challenge.id,
      randomized_order_index: startIndex + index + 1,
      status: !hasOpenChallenge && index === 0 ? "ready" : "pending",
    }));
  });
  if (rows.length === 0) return;
  // This is an admin operation. Using the anonymous gameplay client here made
  // the challenge row succeed but its table assignments fail with RLS (401),
  // leaving a partially-added challenge behind.
  const { error } = await db
    .from("captains_table_challenges")
    .upsert(rows, { onConflict: "table_id,challenge_id", ignoreDuplicates: true });
  ensureNoError(error);
};

export const addCatalogChallengesToCaptainsEvent = async (eventId: string, catalogChallengeIds: string[]) => {
  if (catalogChallengeIds.length === 0) return [];

  const { count, error: countError } = await db
    .from("captains_event_challenges")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  ensureNoError(countError);

  const databaseCatalogIds = catalogChallengeIds.filter(isUuid);
  const [{ data: databaseCatalogItems, error: catalogError }, { data: existingChallenges, error: existingError }] =
    await Promise.all([
      databaseCatalogIds.length
        ? db.from("captains_challenge_catalog").select("*").in("id", databaseCatalogIds)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("captains_event_challenges")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: false })
    ]);
  ensureNoError(catalogError);
  ensureNoError(existingError);

  const catalogById = new Map<string, CaptainsChallengeCatalogItem>();
  ((databaseCatalogItems || []) as CaptainsChallengeCatalogItem[]).forEach((item) => catalogById.set(item.id, item));
  captainsDefaultChallengeCatalog.forEach((item) => {
    if (catalogChallengeIds.includes(item.id)) catalogById.set(item.id, item);
  });
  const catalogItems = catalogChallengeIds.map((id) => catalogById.get(id)).filter(Boolean) as CaptainsChallengeCatalogItem[];
  if (catalogItems.length !== catalogChallengeIds.length) {
    throw new Error("No hemos podido encontrar el reto seleccionado en el catálogo.");
  }

  const existing = (existingChallenges || []) as CaptainsEventChallenge[];
  const existingByCatalogItem = new Map<string, CaptainsEventChallenge>();
  for (const item of catalogItems) {
    const match = existing.find((challenge) =>
      challenge.catalog_challenge_id === item.id
      || challenge.title.trim().toLocaleLowerCase("es") === item.title.trim().toLocaleLowerCase("es")
    );
    if (match) existingByCatalogItem.set(item.id, match as CaptainsEventChallenge);
  }

  // Repair challenges left half-created by an earlier failed assignment. This
  // also makes retries safe when only some tables received the challenge.
  const alreadyAdded = catalogItems
    .map((item) => existingByCatalogItem.get(item.id))
    .filter(Boolean) as CaptainsEventChallenge[];
  if (alreadyAdded.length > 0) {
    await appendCaptainsChallengesToTables(eventId, alreadyAdded);
  }

  const newCatalogItems = catalogItems.filter((item) => !existingByCatalogItem.has(item.id));
  if (newCatalogItems.length === 0) return alreadyAdded;
  ensureCaptainsChallengeLimit((count || existing.length) + newCatalogItems.length);

  const startIndex = existing.length;
  const rows = newCatalogItems.map((item, index) => ({
    event_id: eventId,
    catalog_challenge_id: isUuid(item.id) ? item.id : null,
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
    order_index: startIndex + index + 1,
    is_required: false,
  }));

  const { data, error } = await db.from("captains_event_challenges").insert(rows).select("*");
  if (error && isMissingCaptainQuestionColumnError(error)) {
    const fallback = await db.from("captains_event_challenges").insert(rows.map(withoutCaptainQuestionColumns)).select("*");
    ensureNoError(fallback.error);
    const added = (fallback.data || []) as CaptainsEventChallenge[];
    await appendCaptainsChallengesToTables(eventId, added);
    return [...alreadyAdded, ...added];
  }
  ensureNoError(error);
  const added = (data || []) as CaptainsEventChallenge[];
  await appendCaptainsChallengesToTables(eventId, added);
  return [...alreadyAdded, ...added];
};

export const createCustomCaptainsChallenge = async (eventId: string, input: CaptainsChallengeInput) => {
  const { count, error: countError } = await db
    .from("captains_event_challenges")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  ensureNoError(countError);
  ensureCaptainsChallengeLimit((count || 0) + 1);
  const payload = normalizeChallengeRow(input, Math.max((input.order_index ?? 1) - 1, 0), eventId);
  const { data, error } = await db
    .from("captains_event_challenges")
    .insert({ ...payload, catalog_challenge_id: null })
    .select("*")
    .single();
  if (error && isMissingCaptainQuestionColumnError(error)) {
    const fallback = await db
      .from("captains_event_challenges")
      .insert(withoutCaptainQuestionColumns({ ...payload, catalog_challenge_id: null }))
      .select("*")
      .single();
    ensureNoError(fallback.error);
    const added = fallback.data as CaptainsEventChallenge;
    await appendCaptainsChallengesToTables(eventId, [added]);
    return added;
  }
  ensureNoError(error);
  const added = data as CaptainsEventChallenge;
  await appendCaptainsChallengesToTables(eventId, [added]);
  return added;
};

export const generateRandomChallengeOrderForTable = async (eventId: string, tableId: string) => {
  const { data: existing, error: existingError } = await pdb
    .from("captains_table_challenges")
    .select("*")
    .eq("event_id", eventId)
    .eq("table_id", tableId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(existingError);
  if ((existing || []).length > 0) return existing as CaptainsTableChallenge[];

  const { data: challenges, error: challengesError } = await pdb
    .from("captains_event_challenges")
    .select("*")
    .eq("event_id", eventId);
  ensureNoError(challengesError);

  const rows = shuffleCaptainsItems((challenges || []) as CaptainsEventChallenge[]).map((challenge, index) => ({
    event_id: eventId,
    table_id: tableId,
    challenge_id: challenge.id,
    randomized_order_index: index + 1,
    status: index === 0 ? "ready" : "pending",
  }));

  if (rows.length === 0) return [];

  const { data, error } = await pdb
    .from("captains_table_challenges")
    .upsert(rows, { onConflict: "table_id,challenge_id" })
    .select("*")
    .order("randomized_order_index", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTableChallenge[];
};

const markNextCaptainsChallengeReady = async (eventId: string, tableId: string) => {
  const rows = await getCaptainsTableChallengesForTable(eventId, tableId);
  const alreadyOpen = rows.find((row) => ["ready", "in_progress", "submitted", "pending_review"].includes(row.status));
  if (alreadyOpen) return alreadyOpen;
  const next = rows.find((row) => row.status === "pending");
  if (!next) return null;
  const { error } = await pdb
    .from("captains_table_challenges")
    .update({ status: "ready" })
    .eq("id", next.id);
  ensureNoError(error);
  return { ...next, status: "ready" as const, updated_at: new Date().toISOString() } as CaptainsTableChallenge;
};

export const startCaptainsTableChallenge = async (tableChallengeId: string) => {
  const { data: existing, error: readError } = await pdb
    .from("captains_table_challenges")
    .select("*")
    .eq("id", tableChallengeId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existing) throw new Error("No hemos podido encontrar el reto seleccionado.");
  await ensureCaptainsEventIsOpen(existing.event_id);
  const startedAt = new Date().toISOString();
  const { error } = await pdb
    .from("captains_table_challenges")
    .update({
      status: "in_progress",
      started_at: startedAt,
      is_time_expired: false,
    })
    .eq("id", tableChallengeId);
  ensureNoError(error);
  return {
    ...(existing as CaptainsTableChallenge),
    status: "in_progress",
    started_at: startedAt,
    is_time_expired: false,
    updated_at: startedAt,
  } as CaptainsTableChallenge;
};

export const failCaptainsTableChallenge = async (tableChallengeId: string) => {
  const { data: existing, error: readError } = await pdb
    .from("captains_table_challenges")
    .select("*")
    .eq("id", tableChallengeId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existing) throw new Error("No hemos podido encontrar el reto seleccionado.");
  const reviewedAt = new Date().toISOString();
  const { error } = await pdb
    .from("captains_table_challenges")
    .update({
      status: "failed",
      points_awarded: 0,
      reviewed_at: reviewedAt,
    })
    .eq("id", tableChallengeId);
  ensureNoError(error);
  const row = {
    ...(existing as CaptainsTableChallenge),
    status: "failed",
    points_awarded: 0,
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
  } as CaptainsTableChallenge;
  await recalculateCaptainsTableScore(row.table_id);
  await markNextCaptainsChallengeReady(row.event_id, row.table_id);
  return row;
};

export const expireCaptainsTableChallenge = async (tableChallengeId: string) => {
  const { data: existing, error: readError } = await pdb
    .from("captains_table_challenges")
    .select("*")
    .eq("id", tableChallengeId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existing) throw new Error("No hemos podido encontrar el reto seleccionado.");
  const reviewedAt = new Date().toISOString();
  const { error } = await pdb
    .from("captains_table_challenges")
    .update({
      status: "time_expired",
      points_awarded: 0,
      remaining_seconds: 0,
      is_time_expired: true,
      reviewed_at: reviewedAt,
    })
    .eq("id", tableChallengeId);
  ensureNoError(error);
  const row = {
    ...(existing as CaptainsTableChallenge),
    status: "time_expired",
    points_awarded: 0,
    remaining_seconds: 0,
    is_time_expired: true,
    reviewed_at: reviewedAt,
    updated_at: reviewedAt,
  } as CaptainsTableChallenge;
  await recalculateCaptainsTableScore(row.table_id);
  await markNextCaptainsChallengeReady(row.event_id, row.table_id);
  return row;
};

export const generateRandomChallengeOrderForEvent = async (eventId: string) => {
  const { data: tables, error } = await db.from("captains_tables").select("id").eq("event_id", eventId);
  ensureNoError(error);

  const results = await Promise.all(
    ((tables || []) as Array<{ id: string }>).map((table) => generateRandomChallengeOrderForTable(eventId, table.id)),
  );
  return results.flat();
};

const captainsRankingTerminalStatuses = new Set<CaptainsTableChallengeStatus>([
  "completed",
  "failed",
  "time_expired",
  "pending_review",
  "rejected",
  "deleted",
]);

const timestampValue = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getCaptainsTableCompletionMetrics = (
  table: CaptainsTable,
  rows: CaptainsTableChallenge[],
) => {
  const allChallengesFinished =
    rows.length > 0 && rows.every((row) => captainsRankingTerminalStatuses.has(row.status));
  if (!allChallengesFinished) {
    return { all_challenges_finished: false, completion_duration_seconds: null };
  }

  const challengeStartTimes = rows
    .map((row) => timestampValue(row.started_at))
    .filter((value): value is number => value !== null);
  const fallbackStart = timestampValue(table.claimed_at);
  const startedAt = challengeStartTimes.length > 0 ? Math.min(...challengeStartTimes) : fallbackStart;
  const finishedAtValues = rows
    .map((row) => timestampValue(row.submitted_at) ?? timestampValue(row.reviewed_at) ?? timestampValue(row.updated_at))
    .filter((value): value is number => value !== null);
  const finishedAt = finishedAtValues.length === rows.length ? Math.max(...finishedAtValues) : null;
  const completionDurationSeconds =
    startedAt !== null && finishedAt !== null
      ? Math.max(0, Math.floor((finishedAt - startedAt) / 1000))
      : null;

  return {
    all_challenges_finished: true,
    completion_duration_seconds: completionDurationSeconds,
  };
};

export const rankCaptainsTables = (
  tables: CaptainsTable[],
  tableChallenges: CaptainsTableChallenge[],
) => {
  const challengesByTable = new Map<string, CaptainsTableChallenge[]>();
  tableChallenges.forEach((row) => {
    const currentRows = challengesByTable.get(row.table_id) || [];
    currentRows.push(row);
    challengesByTable.set(row.table_id, currentRows);
  });

  return tables
    .map((table) => ({
      ...table,
      ...getCaptainsTableCompletionMetrics(table, challengesByTable.get(table.id) || []),
    }))
    .sort((first, second) => {
      const pointsDifference = second.total_points - first.total_points;
      if (pointsDifference !== 0) return pointsDifference;

      if (first.all_challenges_finished !== second.all_challenges_finished) {
        return first.all_challenges_finished ? -1 : 1;
      }
      if (first.all_challenges_finished && second.all_challenges_finished) {
        const firstDuration = first.completion_duration_seconds ?? Number.POSITIVE_INFINITY;
        const secondDuration = second.completion_duration_seconds ?? Number.POSITIVE_INFINITY;
        if (firstDuration !== secondDuration) return firstDuration - secondDuration;
      }

      return (
        second.completed_challenges - first.completed_challenges ||
        (timestampValue(first.last_activity_at) ?? Number.POSITIVE_INFINITY) -
          (timestampValue(second.last_activity_at) ?? Number.POSITIVE_INFINITY) ||
        first.table_number - second.table_number
      );
    })
    .map((table, index) => ({ ...table, rank: index + 1 })) as CaptainsRankingItem[];
};

export const getCaptainsRanking = async (eventId: string) => {
  const [{ data: tables, error: tablesError }, { data: tableChallenges, error: challengesError }] =
    await Promise.all([
      pdb.from("captains_tables").select("*").eq("event_id", eventId),
      pdb
        .from("captains_table_challenges")
        .select("*")
        .eq("event_id", eventId),
    ]);
  ensureNoError(tablesError);
  ensureNoError(challengesError);

  return rankCaptainsTables(
    (tables || []) as CaptainsTable[],
    (tableChallenges || []) as CaptainsTableChallenge[],
  );
};

export const getCaptainsEvidence = async (eventId: string, status?: CaptainsEvidenceStatus) => {
  let query = pdb
    .from("captains_evidence")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  else query = query.neq("status", "deleted");

  const { data, error } = await query;
  ensureNoError(error);
  return (data || []) as CaptainsEvidence[];
};

export const getCaptainsEvidenceIndex = async (eventId: string) => {
  const { data, error } = await db
    .from("captains_evidence")
    .select("id,table_id,table_challenge_id,evidence_type,file_url,status,created_at")
    .eq("event_id", eventId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  ensureNoError(error);
  return (data || []) as CaptainsEvidenceIndexItem[];
};

export const getCaptainsEvidenceForDownload = async (eventId: string) => {
  const all: CaptainsEvidence[] = [];
  const pageSize = 500;
  const startedAt = new Date().toISOString();
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await pdb.from("captains_evidence")
      .select("*").eq("event_id", eventId).neq("status", "deleted")
      .lte("created_at", startedAt)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    ensureNoError(error);
    const page = (data || []) as CaptainsEvidence[];
    all.push(...page);
    if (page.length < pageSize) return all;
  }
};

export const getCaptainsEvidenceGroup = async (
  eventId: string,
  filter: { tableId?: string; tableChallengeIds?: string[] },
) => {
  let query = db
    .from("captains_evidence")
    .select("*")
    .eq("event_id", eventId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (filter.tableId) {
    query = query.eq("table_id", filter.tableId);
  } else if (filter.tableChallengeIds?.length) {
    query = query.in("table_challenge_id", filter.tableChallengeIds);
  } else {
    return [] as CaptainsEvidence[];
  }

  const { data, error } = await query;
  ensureNoError(error);
  return (data || []) as CaptainsEvidence[];
};

export const uploadCaptainsEvidence = async ({
  eventId,
  tableId,
  tableChallengeId,
  captainName,
  evidenceType,
  file,
  thumbnail,
  elapsedSeconds,
  remainingSeconds,
  scoringMode = "manual",
  onProgress,
}: {
  eventId: string;
  tableId: string;
  tableChallengeId: string;
  captainName?: string | null;
  evidenceType: "photo" | "video";
  file: File;
  thumbnail?: File | null;
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
  scoringMode?: CaptainsScoringMode;
  onProgress?: (percentage: number) => void;
}) => {
  await ensureCaptainsEventIsOpen(eventId);
  const { data: tableChallenge, error: challengeError } = await pdb
    .from("captains_table_challenges")
    .select("*, captains_event_challenges(*)")
    .eq("id", tableChallengeId)
    .single();
  ensureNoError(challengeError);
  if (
    tableChallenge?.event_id !== eventId ||
    tableChallenge?.table_id !== tableId ||
    tableChallenge?.status !== "in_progress"
  ) {
    throw new Error("El estado del reto ha cambiado. Vuelve a abrirlo.");
  }

  let uploadFile = file;
  if (evidenceType === "photo") {
    try {
      uploadFile = await compressImage(file, 1.5);
    } catch {
      // Some mobile image formats cannot be redrawn by every browser. The
      // original camera file is still valid and can be uploaded unchanged.
      uploadFile = file;
    }
  }
  const fileId = crypto.randomUUID();
  const fileName = sanitizeCaptainsFileName(uploadFile.name || `${evidenceType}-${fileId}`);
  const filePath = `${eventId}/${tableId}/${tableChallengeId}/${fileId}-${fileName}`;
  let thumbnailPath = thumbnail
    ? `${eventId}/${tableId}/${tableChallengeId}/${fileId}-thumbnail.jpg`
    : null;

  await uploadCaptainsEvidenceFile(filePath, uploadFile, onProgress);
  if (thumbnailPath && thumbnail) {
    try {
      await uploadCaptainsEvidenceFile(thumbnailPath, thumbnail);
    } catch (cause) {
      // The evidence itself is already safely stored. A browser-generated
      // thumbnail should never prevent the team from completing the challenge.
      console.warn("Captains video thumbnail upload failed:", cause);
      thumbnailPath = null;
    }
  }

  const challenge = tableChallenge?.captains_event_challenges as CaptainsEventChallenge | undefined;
  const pointsAwarded =
    scoringMode === "automatic"
      ? calculateCaptainsAutomaticScore({
          maxPoints: challenge?.points ?? 0,
          hasTimeLimit: challenge?.has_time_limit ?? false,
          totalSeconds: challenge?.time_limit_seconds ?? null,
          remainingSeconds,
          succeeded: true,
        })
      : 0;
  const evidenceStatus: CaptainsEvidenceStatus = scoringMode === "automatic" ? "approved" : "pending_review";
  const challengeStatus: CaptainsTableChallengeStatus = scoringMode === "automatic" ? "completed" : "pending_review";
  const reviewedAt = scoringMode === "automatic" ? new Date().toISOString() : null;

  const evidenceId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const { error } = await pdb
    .from("captains_evidence")
    .insert({
      id: evidenceId,
      event_id: eventId,
      table_id: tableId,
      table_challenge_id: tableChallengeId,
      captain_name: captainName ?? null,
      evidence_type: evidenceType,
      file_url: filePath,
      // The optional poster lives beside the video, rather than requiring a
      // schema migration before a photo/video submission can be registered.
      status: evidenceStatus,
      points_awarded: pointsAwarded,
      elapsed_seconds: elapsedSeconds ?? null,
      remaining_seconds: remainingSeconds ?? null,
      reviewed_at: reviewedAt,
      created_at: createdAt,
    });
  ensureNoError(error);

  const { error: updateChallengeError } = await pdb
    .from("captains_table_challenges")
    .update({
      status: challengeStatus,
      points_awarded: pointsAwarded,
      submitted_at: createdAt,
      elapsed_seconds: elapsedSeconds ?? null,
      remaining_seconds: remainingSeconds ?? null,
      reviewed_at: reviewedAt,
      automatic_score_calculated: scoringMode === "automatic",
    })
    .eq("id", tableChallengeId);
  ensureNoError(updateChallengeError);

  await recalculateCaptainsTableScore(tableId);
  await markNextCaptainsChallengeReady(eventId, tableId);

  return {
    id: evidenceId,
    event_id: eventId,
    table_id: tableId,
    table_challenge_id: tableChallengeId,
    captain_name: captainName ?? null,
    evidence_type: evidenceType,
    file_url: filePath,
    thumbnail_url: thumbnailPath,
    status: evidenceStatus,
    points_awarded: pointsAwarded,
    admin_comment: null,
    elapsed_seconds: elapsedSeconds ?? null,
    remaining_seconds: remainingSeconds ?? null,
    created_at: createdAt,
    reviewed_at: reviewedAt,
    deleted_at: null,
  } as CaptainsEvidence;
};

export const completeCaptainsQuestionChallenge = async ({
  eventId,
  tableId,
  tableChallengeId,
  answer,
  elapsedSeconds,
  remainingSeconds,
}: {
  eventId: string;
  tableId: string;
  tableChallengeId: string;
  answer: string;
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
}) => {
  await ensureCaptainsEventIsOpen(eventId);
  const { data: tableChallenge, error: challengeError } = await pdb
    .from("captains_table_challenges")
    .select("*, captains_event_challenges(*)")
    .eq("id", tableChallengeId)
    .single();
  ensureNoError(challengeError);
  if (
    tableChallenge?.event_id !== eventId ||
    tableChallenge?.table_id !== tableId ||
    tableChallenge?.status !== "in_progress"
  ) {
    throw new Error("El estado del reto ha cambiado. Vuelve a abrirlo.");
  }

  const challenge = tableChallenge?.captains_event_challenges as CaptainsEventChallenge | undefined;
  const correct = Boolean(challenge?.question_correct_option && answer === challenge.question_correct_option);
  const pointsAwarded = correct
    ? calculateCaptainsAutomaticScore({
        maxPoints: challenge?.points ?? 0,
        hasTimeLimit: challenge?.has_time_limit ?? false,
        totalSeconds: challenge?.time_limit_seconds ?? null,
        remainingSeconds,
        succeeded: true,
      })
    : 0;
  const reviewedAt = new Date().toISOString();
  const { error } = await pdb
    .from("captains_table_challenges")
    .update({
      status: correct ? "completed" : "failed",
      points_awarded: pointsAwarded,
      submitted_at: reviewedAt,
      elapsed_seconds: elapsedSeconds ?? null,
      remaining_seconds: remainingSeconds ?? null,
      question_answer: answer,
      reviewed_at: reviewedAt,
      automatic_score_calculated: true,
    })
    .eq("id", tableChallengeId);
  ensureNoError(error);

  await recalculateCaptainsTableScore(tableId);
  await markNextCaptainsChallengeReady(eventId, tableId);

  return {
    row: {
      ...(tableChallenge as CaptainsTableChallenge),
      status: correct ? "completed" : "failed",
      points_awarded: pointsAwarded,
      submitted_at: reviewedAt,
      elapsed_seconds: elapsedSeconds ?? null,
      remaining_seconds: remainingSeconds ?? null,
      question_answer: answer,
      reviewed_at: reviewedAt,
      automatic_score_calculated: true,
      updated_at: reviewedAt,
    } as CaptainsTableChallenge,
    correct,
    pointsAwarded,
  };
};

export const recalculateCaptainsTableScore = async (tableId: string) => {
  const { data: challenges, error } = await pdb
    .from("captains_table_challenges")
    .select("status, points_awarded")
    .eq("table_id", tableId)
    .neq("status", "deleted");
  ensureNoError(error);

  const rows = (challenges || []) as Array<{ status: CaptainsTableChallengeStatus; points_awarded: number }>;
  const totalPoints = rows.reduce((sum, challenge) => sum + (challenge.points_awarded || 0), 0);
  const completed = rows.filter((challenge) => challenge.status === "completed").length;
  const failed = rows.filter((challenge) =>
    ["failed", "time_expired", "rejected"].includes(challenge.status),
  ).length;

  const lastActivityAt = new Date().toISOString();
  const { error: updateError } = await pdb
    .from("captains_tables")
    .update({
      total_points: totalPoints,
      completed_challenges: completed,
      failed_challenges: failed,
      last_activity_at: lastActivityAt,
    })
    .eq("id", tableId);
  ensureNoError(updateError);
  return {
    id: tableId,
    total_points: totalPoints,
    completed_challenges: completed,
    failed_challenges: failed,
    last_activity_at: lastActivityAt,
  } as CaptainsTable;
};

export const approveCaptainsEvidence = async (
  evidenceId: string,
  options?: { pointsAwarded?: number; adminComment?: string | null },
) => {
  const { data: evidence, error: evidenceError } = await db
    .from("captains_evidence")
    .select("*, captains_table_challenges(*, captains_event_challenges(*))")
    .eq("id", evidenceId)
    .single();
  ensureNoError(evidenceError);

  const tableChallenge = evidence.captains_table_challenges as
    | (CaptainsTableChallenge & { captains_event_challenges?: CaptainsEventChallenge })
    | undefined;
  const challenge = tableChallenge?.captains_event_challenges;
  const pointsAwarded =
    options?.pointsAwarded ??
    calculateCaptainsAutomaticScore({
      maxPoints: challenge?.points ?? 0,
      hasTimeLimit: challenge?.has_time_limit ?? false,
      totalSeconds: challenge?.time_limit_seconds ?? null,
      remainingSeconds: evidence.remaining_seconds,
      succeeded: true,
    });
  const reviewedAt = new Date().toISOString();

  const { data, error } = await db
    .from("captains_evidence")
    .update({
      status: "approved",
      points_awarded: pointsAwarded,
      admin_comment: options?.adminComment ?? null,
      reviewed_at: reviewedAt,
    })
    .eq("id", evidenceId)
    .select("*")
    .single();
  ensureNoError(error);

  await db
    .from("captains_table_challenges")
    .update({
      status: "completed",
      points_awarded: pointsAwarded,
      reviewed_at: reviewedAt,
      automatic_score_calculated: options?.pointsAwarded === undefined,
    })
    .eq("id", evidence.table_challenge_id);
  await recalculateCaptainsTableScore(evidence.table_id);

  return data as CaptainsEvidence;
};

export const rejectCaptainsEvidence = async (evidenceId: string, adminComment?: string | null) => {
  const reviewedAt = new Date().toISOString();
  const { data, error } = await db
    .from("captains_evidence")
    .update({
      status: "rejected",
      points_awarded: 0,
      admin_comment: adminComment ?? null,
      reviewed_at: reviewedAt,
    })
    .eq("id", evidenceId)
    .select("*")
    .single();
  ensureNoError(error);

  const evidence = data as CaptainsEvidence;
  await db
    .from("captains_table_challenges")
    .update({ status: "rejected", points_awarded: 0, reviewed_at: reviewedAt })
    .eq("id", evidence.table_challenge_id);
  await recalculateCaptainsTableScore(evidence.table_id);

  return evidence;
};

export const deleteCaptainsEvidence = async (evidenceId: string) => {
  const { data, error } = await db
    .from("captains_evidence")
    .select("*")
    .eq("id", evidenceId)
    .single();
  ensureNoError(error);

  const evidence = data as CaptainsEvidence;
  const storagePaths = [...new Set([
    getCaptainsEvidenceStoragePath(evidence.file_url),
    getCaptainsEvidenceStoragePath(getCaptainsEvidenceThumbnailPath(evidence)),
  ].filter((path): path is string => Boolean(path)))];
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(CAPTAINS_EVIDENCE_BUCKET).remove(storagePaths);
    ensureNoError(storageError);
  }

  const { error: deleteError } = await db.from("captains_evidence").delete().eq("id", evidenceId);
  ensureNoError(deleteError);

  const { error: challengeError } = await db
    .from("captains_table_challenges")
    .update({ status: "deleted", points_awarded: 0 })
    .eq("id", evidence.table_challenge_id);
  ensureNoError(challengeError);
  await recalculateCaptainsTableScore(evidence.table_id);

  return evidence;
};

export const updateCaptainsEvidence = async (
  evidenceId: string,
  input: Pick<CaptainsEvidence, "status" | "points_awarded"> & { admin_comment?: string | null },
) => {
  const { data, error } = await db.from("captains_evidence").update(input).eq("id", evidenceId).select("*").single();
  ensureNoError(error);
  const evidence = data as CaptainsEvidence;
  const tableChallengeStatus: CaptainsTableChallengeStatus =
    input.status === "approved"
      ? "completed"
      : input.status === "uploaded"
        ? "submitted"
        : input.status;
  await db
    .from("captains_table_challenges")
    .update({
      status: tableChallengeStatus,
      points_awarded: input.points_awarded,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", evidence.table_challenge_id);
  await recalculateCaptainsTableScore(evidence.table_id);
  return evidence;
};

export const recalculateCaptainsRanking = async (eventId: string) => {
  const { data: tables, error } = await db.from("captains_tables").select("id").eq("event_id", eventId);
  ensureNoError(error);

  await Promise.all(((tables || []) as Array<{ id: string }>).map((table) => recalculateCaptainsTableScore(table.id)));
  return getCaptainsRanking(eventId);
};
