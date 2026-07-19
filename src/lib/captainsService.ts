import { supabase } from "@/integrations/supabase/client";
import { supabasePublic } from "@/integrations/supabase/publicClient";
import { captainsDefaultChallengeCatalog } from "@/lib/captainsDefaultChallengeCatalog";
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

  const enriched = await Promise.all(
    events.map(async (event) => {
      const [tablesRes, challengesRes] = await Promise.all([
        db.from("captains_tables").select("id", { count: "exact", head: true }).eq("event_id", event.id),
        db.from("captains_event_challenges").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      ]);

      return {
        ...event,
        table_count: tablesRes.error ? 0 : tablesRes.count ?? 0,
        challenge_count: challengesRes.error ? 0 : challengesRes.count ?? 0,
      } as CaptainsEventListItem;
    }),
  );

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

export const resetCaptainsTableLastActivity = async (tableId: string) => {
  const { data: evidenceRows, error: evidenceReadError } = await db
    .from("captains_evidence")
    .select("id,file_url,thumbnail_url")
    .eq("table_id", tableId);
  ensureNoError(evidenceReadError);

  const storagePaths = [...new Set(((evidenceRows || []) as Array<Pick<CaptainsEvidence, "file_url" | "thumbnail_url">>)
    .flatMap((evidence) => [
      getCaptainsEvidenceStoragePath(evidence.file_url),
      getCaptainsEvidenceStoragePath(evidence.thumbnail_url),
    ])
    .filter((path): path is string => Boolean(path)))];
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from(CAPTAINS_EVIDENCE_BUCKET).remove(storagePaths);
    ensureNoError(storageError);
  }

  const { error: evidenceDeleteError } = await db.from("captains_evidence").delete().eq("table_id", tableId);
  ensureNoError(evidenceDeleteError);

  const { data: challengeRows, error: challengeReadError } = await db
    .from("captains_table_challenges")
    .select("id")
    .eq("table_id", tableId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(challengeReadError);

  const challengeIds = ((challengeRows || []) as Array<{ id: string }>).map((row) => row.id);
  if (challengeIds.length > 0) {
    const { error: resetChallengesError } = await db
      .from("captains_table_challenges")
      .update({
        status: "pending",
        points_awarded: 0,
        started_at: null,
        submitted_at: null,
        elapsed_seconds: null,
        remaining_seconds: null,
        question_answer: null,
        is_time_expired: false,
        automatic_score_calculated: false,
        reviewed_at: null,
      })
      .in("id", challengeIds);
    ensureNoError(resetChallengesError);

    const { error: firstChallengeError } = await db
      .from("captains_table_challenges")
      .update({ status: "ready" })
      .eq("id", challengeIds[0]);
    ensureNoError(firstChallengeError);
  }

  const { data, error } = await db
    .from("captains_tables")
    .update({
      total_points: 0,
      completed_challenges: 0,
      failed_challenges: 0,
      current_challenge_id: null,
      completed_at: null,
      last_activity_at: null,
      claimed_at: null,
      claim_device_hash: null,
    })
    .eq("id", tableId)
    .select("*")
    .single();
  ensureNoError(error);
  return data as CaptainsTable;
};

export const resetAllCaptainsTables = async (eventId: string) => {
  const { data, error } = await db.from("captains_tables").select("id").eq("event_id", eventId);
  ensureNoError(error);
  await Promise.all(((data || []) as Array<{ id: string }>).map((table) => resetCaptainsTableLastActivity(table.id)));
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

export const getCaptainsEvidenceSignedUrl = async (filePath: string, thumbnail = false) => {
  const { data, error } = await supabasePublic.storage.from(CAPTAINS_EVIDENCE_BUCKET).createSignedUrl(
    filePath,
    3600,
    thumbnail ? { transform: { width: 720, height: 405, resize: "cover", quality: 72 } } : undefined,
  );
  ensureNoError(error);
  return data?.signedUrl || "";
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
  const { error } = await pdb.from("captains_table_challenges").insert(rows);
  ensureNoError(error);
};

export const addCatalogChallengesToCaptainsEvent = async (eventId: string, catalogChallengeIds: string[]) => {
  if (catalogChallengeIds.length === 0) return [];

  const { count, error: countError } = await db
    .from("captains_event_challenges")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  ensureNoError(countError);
  ensureCaptainsChallengeLimit((count || 0) + catalogChallengeIds.length);

  const databaseCatalogIds = catalogChallengeIds.filter(isUuid);
  const [{ data: databaseCatalogItems, error: catalogError }, { data: existingChallenges, error: existingError }] =
    await Promise.all([
      databaseCatalogIds.length
        ? db.from("captains_challenge_catalog").select("*").in("id", databaseCatalogIds)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("captains_event_challenges")
        .select("catalog_challenge_id,title")
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

  const existing = (existingChallenges || []) as Array<{ catalog_challenge_id: string | null; title: string }>;
  const duplicate = catalogItems.find((item) =>
    existing.some((challenge) => challenge.catalog_challenge_id === item.id || challenge.title.trim().toLocaleLowerCase("es") === item.title.trim().toLocaleLowerCase("es")),
  );
  if (duplicate) throw new Error(`El reto “${duplicate.title}” ya está añadido al evento.`);

  const startIndex = existing.length;
  const rows = catalogItems.map((item, index) => ({
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
    return added;
  }
  ensureNoError(error);
  const added = (data || []) as CaptainsEventChallenge[];
  await appendCaptainsChallengesToTables(eventId, added);
  return added;
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

export const getCaptainsRanking = async (eventId: string) => {
  const { data, error } = await pdb
    .from("captains_tables")
    .select("*")
    .eq("event_id", eventId)
    .order("total_points", { ascending: false })
    .order("completed_challenges", { ascending: false })
    .order("last_activity_at", { ascending: true, nullsFirst: false });
  ensureNoError(error);

  return ((data || []) as CaptainsTable[]).map((table, index) => ({
    ...table,
    rank: index + 1,
  })) as CaptainsRankingItem[];
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
  elapsedSeconds,
  remainingSeconds,
  scoringMode = "manual",
}: {
  eventId: string;
  tableId: string;
  tableChallengeId: string;
  captainName?: string | null;
  evidenceType: "photo" | "video";
  file: File;
  elapsedSeconds?: number | null;
  remainingSeconds?: number | null;
  scoringMode?: CaptainsScoringMode;
}) => {
  await ensureCaptainsEventIsOpen(eventId);
  const fileId = crypto.randomUUID();
  const fileName = sanitizeCaptainsFileName(file.name || `${evidenceType}-${fileId}`);
  const filePath = `${eventId}/${tableId}/${tableChallengeId}/${fileId}-${fileName}`;

  const { error: uploadError } = await supabasePublic.storage.from(CAPTAINS_EVIDENCE_BUCKET).upload(filePath, file);
  ensureNoError(uploadError);

  const { data: tableChallenge, error: challengeError } = await pdb
    .from("captains_table_challenges")
    .select("*, captains_event_challenges(*)")
    .eq("id", tableChallengeId)
    .single();
  ensureNoError(challengeError);

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
    thumbnail_url: null,
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
    getCaptainsEvidenceStoragePath(evidence.thumbnail_url),
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
