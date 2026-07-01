import { supabase } from "@/integrations/supabase/client";
import { captainsDefaultChallengeCatalog } from "@/lib/captainsDefaultChallengeCatalog";
import {
  calculateCaptainsAutomaticScore,
  getCaptainsPublicUrl,
  getCaptainsQrValue,
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
  CaptainsEvidenceStatus,
  CaptainsRankingItem,
  CaptainsTable,
  CaptainsTableChallenge,
  CaptainsTableChallengeStatus,
  CreateCaptainsEventInput,
  CaptainsScoringMode,
  CaptainsSpriteConfig,
  CaptainsSpriteStyle,
} from "@/lib/captainsTypes";

const db = supabase as any;
const CAPTAINS_EVIDENCE_BUCKET = "captains-evidence";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const ensureNoError = (error: unknown) => {
  if (error) throw error;
};

const captainThemeColumns = ["primary_color", "secondary_color", "background_image_url"];

const withoutCaptainThemeColumns = <T extends Record<string, unknown>>(payload: T) => {
  const next = { ...payload };
  captainThemeColumns.forEach((column) => delete next[column]);
  return next;
};

const isMissingCaptainThemeColumnError = (error: unknown) => {
  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return captainThemeColumns.some((column) => message.includes(column));
};

const captainTableVisualColumns = ["captain_sprite", "captain_sprite_config"];

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
    .replaceAll("Grabad un audio", "Grabad un vídeo")
    .replaceAll("grabe un audio", "grabe un vídeo")
    .replaceAll("un audio", "un vídeo")
    .replaceAll("en audio", "en vídeo")
    .replaceAll("audio", "vídeo")
    .replaceAll("Audio", "Vídeo");

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
    start_time: input.start_time ?? null,
    end_time: input.end_time ?? null,
    scoring_mode: input.scoring_mode ?? "automatic",
    status: input.status ?? "draft",
    show_live_gallery_after_completion: input.show_live_gallery_after_completion ?? true,
    primary_color: input.primary_color ?? null,
    secondary_color: input.secondary_color ?? null,
    background_image_url: input.background_image_url ?? null,
    public_url: publicUrl,
    qr_url: getCaptainsQrValue(slug),
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
    captain_sprite?: CaptainsSpriteStyle | null;
    captain_sprite_config?: CaptainsSpriteConfig | null;
  }>;
  challenges: CaptainsChallengeInput[];
}) => {
  const createdEvent = await createCaptainsEvent(event);

  if (tables.length > 0) {
    const tableRows = tables.map((table) => ({
      event_id: createdEvent.id,
      table_number: table.table_number,
      table_name: table.table_name?.trim() || `Mesa ${table.table_number}`,
      captain_name: table.captain_name?.trim() || null,
      active_captain_name: table.captain_name?.trim() || null,
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
    payload.qr_url = input.qr_url || getCaptainsQrValue(slug);
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

export const replaceCaptainsEventChallenges = async (eventId: string, challenges: CaptainsChallengeInput[]) => {
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
  const eventQuery = db.from("captains_events").select("*").limit(1);
  const { data: event, error: eventError } = isUuid(identifier)
    ? await eventQuery.eq("id", identifier).maybeSingle()
    : await eventQuery.eq("slug", identifier).maybeSingle();
  ensureNoError(eventError);
  if (!event) return null;

  const [tablesRes, challengesRes] = await Promise.all([
    db.from("captains_tables").select("*").eq("event_id", event.id).order("table_number", { ascending: true }),
    db.from("captains_event_challenges").select("*").eq("event_id", event.id).order("order_index", { ascending: true }),
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
  const { data, error } = await db
    .from("captains_table_challenges")
    .select("*")
    .eq("event_id", eventId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTableChallenge[];
};

export const getCaptainsTableChallengesForTable = async (eventId: string, tableId: string) => {
  const { data, error } = await db
    .from("captains_table_challenges")
    .select("*")
    .eq("event_id", eventId)
    .eq("table_id", tableId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTableChallenge[];
};

export const getCaptainsEvidenceSignedUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage.from(CAPTAINS_EVIDENCE_BUCKET).createSignedUrl(filePath, 3600);
  ensureNoError(error);
  return data?.signedUrl || "";
};

export const saveCaptainForTable = async (tableId: string, captainName: string) => {
  const cleanName = captainName.trim();
  const { data: existingTable, error: readError } = await db
    .from("captains_tables")
    .select("*")
    .eq("id", tableId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existingTable) throw new Error("No hemos podido encontrar la mesa seleccionada.");
  const lastActivityAt = new Date().toISOString();
  const { error } = await db
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
  const { data: existingTable, error: readError } = await db
    .from("captains_tables")
    .select("*")
    .eq("id", tableId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existingTable) throw new Error("No hemos podido encontrar la mesa seleccionada.");

  const { error } = await db
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

  const { error: accessError } = await db.from("captains_table_accesses").insert({
    event_id: table.event_id,
    table_id: tableId,
    table_name: table.table_name,
    captain_name: cleanName,
    session_token: table.session_token,
    selected_at: selectedAt,
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    device_info:
      typeof window === "undefined"
        ? null
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            platform: navigator.platform,
            language: navigator.language,
          },
  });
  if (accessError) console.warn("Could not log captains table access:", accessError);

  return {
    table,
    selected_at: selectedAt,
    user_agent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    device_info:
      typeof window === "undefined"
        ? null
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            platform: navigator.platform,
          },
  };
};

export const getCaptainsChallengeCatalog = async (activeOnly = true) => {
  let query = db
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

export const addCatalogChallengesToCaptainsEvent = async (eventId: string, catalogChallengeIds: string[]) => {
  if (catalogChallengeIds.length === 0) return [];

  const [{ data: catalogItems, error: catalogError }, { data: existingChallenges, error: existingError }] =
    await Promise.all([
      db.from("captains_challenge_catalog").select("*").in("id", catalogChallengeIds),
      db
        .from("captains_event_challenges")
        .select("order_index")
        .eq("event_id", eventId)
        .order("order_index", { ascending: false })
        .limit(1),
    ]);
  ensureNoError(catalogError);
  ensureNoError(existingError);

  const startIndex = existingChallenges?.[0]?.order_index ?? 0;
  const rows = (catalogItems || []).map((item: CaptainsChallengeCatalogItem, index: number) => ({
    event_id: eventId,
    catalog_challenge_id: item.id,
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
    return (fallback.data || []) as CaptainsEventChallenge[];
  }
  ensureNoError(error);
  return (data || []) as CaptainsEventChallenge[];
};

export const createCustomCaptainsChallenge = async (eventId: string, input: CaptainsChallengeInput) => {
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
    return fallback.data as CaptainsEventChallenge;
  }
  ensureNoError(error);
  return data as CaptainsEventChallenge;
};

export const generateRandomChallengeOrderForTable = async (eventId: string, tableId: string) => {
  const { data: existing, error: existingError } = await db
    .from("captains_table_challenges")
    .select("*")
    .eq("event_id", eventId)
    .eq("table_id", tableId)
    .order("randomized_order_index", { ascending: true });
  ensureNoError(existingError);
  if ((existing || []).length > 0) return existing as CaptainsTableChallenge[];

  const { data: challenges, error: challengesError } = await db
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

  const { data, error } = await db
    .from("captains_table_challenges")
    .upsert(rows, { onConflict: "table_id,challenge_id" })
    .select("*")
    .order("randomized_order_index", { ascending: true });
  ensureNoError(error);
  return (data || []) as CaptainsTableChallenge[];
};

const markNextCaptainsChallengeReady = async (eventId: string, tableId: string) => {
  const rows = await getCaptainsTableChallengesForTable(eventId, tableId);
  const next = rows.find((row) => row.status === "pending");
  if (!next) return null;
  const { error } = await db
    .from("captains_table_challenges")
    .update({ status: "ready" })
    .eq("id", next.id);
  ensureNoError(error);
  return { ...next, status: "ready" as const, updated_at: new Date().toISOString() } as CaptainsTableChallenge;
};

export const startCaptainsTableChallenge = async (tableChallengeId: string) => {
  const { data: existing, error: readError } = await db
    .from("captains_table_challenges")
    .select("*")
    .eq("id", tableChallengeId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existing) throw new Error("No hemos podido encontrar el reto seleccionado.");
  const startedAt = new Date().toISOString();
  const { error } = await db
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
  const { data: existing, error: readError } = await db
    .from("captains_table_challenges")
    .select("*")
    .eq("id", tableChallengeId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existing) throw new Error("No hemos podido encontrar el reto seleccionado.");
  const reviewedAt = new Date().toISOString();
  const { error } = await db
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
  const { data: existing, error: readError } = await db
    .from("captains_table_challenges")
    .select("*")
    .eq("id", tableChallengeId)
    .maybeSingle();
  ensureNoError(readError);
  if (!existing) throw new Error("No hemos podido encontrar el reto seleccionado.");
  const reviewedAt = new Date().toISOString();
  const { error } = await db
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
  const { data, error } = await db
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
  let query = db
    .from("captains_evidence")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

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
  const fileId = crypto.randomUUID();
  const fileName = sanitizeCaptainsFileName(file.name || `${evidenceType}-${fileId}`);
  const filePath = `${eventId}/${tableId}/${tableChallengeId}/${fileId}-${fileName}`;

  const { error: uploadError } = await supabase.storage.from(CAPTAINS_EVIDENCE_BUCKET).upload(filePath, file);
  ensureNoError(uploadError);

  const { data: tableChallenge, error: challengeError } = await db
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
  const { error } = await db
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

  const { error: updateChallengeError } = await db
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
  const { data: tableChallenge, error: challengeError } = await db
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
  const { error } = await db
    .from("captains_table_challenges")
    .update({
      status: correct ? "completed" : "failed",
      points_awarded: pointsAwarded,
      submitted_at: reviewedAt,
      elapsed_seconds: elapsedSeconds ?? null,
      remaining_seconds: remainingSeconds ?? null,
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
      reviewed_at: reviewedAt,
      automatic_score_calculated: true,
      updated_at: reviewedAt,
    } as CaptainsTableChallenge,
    correct,
    pointsAwarded,
  };
};

export const recalculateCaptainsTableScore = async (tableId: string) => {
  const { data: challenges, error } = await db
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
  const { error: updateError } = await db
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
  const deletedAt = new Date().toISOString();
  const { data, error } = await db
    .from("captains_evidence")
    .update({
      status: "deleted",
      points_awarded: 0,
      deleted_at: deletedAt,
    })
    .eq("id", evidenceId)
    .select("*")
    .single();
  ensureNoError(error);

  const evidence = data as CaptainsEvidence;
  await db
    .from("captains_table_challenges")
    .update({ status: "deleted", points_awarded: 0 })
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
