import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_PUBLISHABLE_KEYS = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";

const DEMO_SLUG = "demo-capitanes-v2";
const DEMO_EVENT_ID = "de100000-0000-4000-8000-000000000001";
const BUCKET = "captains-evidence";
const REMOVE_BATCH = 100;
const LIST_BATCH = 100;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const allowedApiKeys = () => {
  const keys = new Set<string>();
  if (SUPABASE_ANON_KEY) keys.add(SUPABASE_ANON_KEY);
  try {
    const parsed = JSON.parse(SUPABASE_PUBLISHABLE_KEYS) as Record<string, string> | string[];
    (Array.isArray(parsed) ? parsed : Object.values(parsed)).forEach((key) => keys.add(key));
  } catch {
    if (SUPABASE_PUBLISHABLE_KEYS.startsWith("sb_publishable_")) keys.add(SUPABASE_PUBLISHABLE_KEYS);
  }
  if (SUPABASE_SERVICE_ROLE_KEY) keys.add(SUPABASE_SERVICE_ROLE_KEY);
  return keys;
};

const storagePathFromValue = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value.trim();
  if (!/^https?:\/\//i.test(clean)) {
    return clean.replace(/^\/+/, "").replace(new RegExp(`^${BUCKET}/`), "");
  }
  try {
    const pathname = decodeURIComponent(new URL(clean).pathname);
    const markers = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/object/sign/${BUCKET}/`,
      `/storage/v1/object/${BUCKET}/`,
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    return marker ? pathname.slice(pathname.indexOf(marker) + marker.length) : null;
  } catch {
    return null;
  }
};

type Admin = ReturnType<typeof createClient>;

const listRecursive = async (admin: Admin, prefix: string, acc: string[]): Promise<void> => {
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
      limit: LIST_BATCH,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`LIST_FAILED:${prefix}:${error.message}`);
    const entries = data ?? [];
    if (!entries.length) return;
    for (const entry of entries) {
      const path = `${prefix}/${entry.name}`;
      if (entry.id === null && !entry.metadata) await listRecursive(admin, path, acc);
      else acc.push(path);
    }
    if (entries.length < LIST_BATCH) return;
    offset += entries.length;
  }
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = req.headers.get("apikey") ?? "";
  if (!apiKey || !allowedApiKeys().has(apiKey)) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Missing server configuration" }, 500);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // SAFETY GUARD: the slug and the id must match simultaneously.
  const { data: event, error: eventError } = await admin
    .from("captains_events")
    .select("id,slug")
    .eq("id", DEMO_EVENT_ID)
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (eventError) return json({ error: "LOAD_EVENT_FAILED", detail: eventError.message }, 500);
  if (!event) return json({ error: "DEMO_EVENT_GUARD_FAILED", aborted: true }, 409);

  const eventId = event.id as string;

  try {
    // 1. Collect storage paths belonging exclusively to this event.
    const { data: evidence, error: evidenceLoadError } = await admin
      .from("captains_evidence")
      .select("id,file_url")
      .eq("event_id", eventId);
    if (evidenceLoadError) throw new Error(`LOAD_EVIDENCE_FAILED:${evidenceLoadError.message}`);

    const paths = new Set<string>();
    for (const row of evidence ?? []) {
      const path = storagePathFromValue(row.file_url);
      if (path && path.startsWith(`${eventId}/`)) paths.add(path);
    }
    const listed: string[] = [];
    await listRecursive(admin, eventId, listed);
    listed.filter((path) => path.startsWith(`${eventId}/`)).forEach((path) => paths.add(path));

    // 2. Physically remove storage objects in batches before touching evidence rows.
    const allPaths = [...paths];
    let deletedObjects = 0;
    for (let offset = 0; offset < allPaths.length; offset += REMOVE_BATCH) {
      const batch = allPaths.slice(offset, offset + REMOVE_BATCH);
      const { data: removed, error: removeError } = await admin.storage.from(BUCKET).remove(batch);
      if (removeError) throw new Error(`DELETE_STORAGE_FAILED:${removeError.message}`);
      deletedObjects += removed?.length ?? batch.length;
    }

    const leftover: string[] = [];
    await listRecursive(admin, eventId, leftover);
    if (leftover.length > 0) {
      throw new Error(`STORAGE_NOT_EMPTY:${leftover.length}`);
    }

    // 3. Evidence rows (only after storage is confirmed empty).
    const { data: deletedEvidence, error: deleteEvidenceError } = await admin
      .from("captains_evidence")
      .delete()
      .eq("event_id", eventId)
      .select("id");
    if (deleteEvidenceError) throw new Error(`DELETE_EVIDENCE_FAILED:${deleteEvidenceError.message}`);

    // 4. Reset challenge progress rows.
    const { data: progress, error: progressError } = await admin
      .from("captains_table_challenges")
      .select("id,table_id,randomized_order_index")
      .eq("event_id", eventId)
      .order("randomized_order_index", { ascending: true });
    if (progressError) throw new Error(`LOAD_PROGRESS_FAILED:${progressError.message}`);

    const nowIso = new Date().toISOString();
    let resetProgress = 0;
    if ((progress ?? []).length > 0) {
      const { error: resetError } = await admin
        .from("captains_table_challenges")
        .update({
          status: "pending",
          points_awarded: 0,
          question_answer: null,
          started_at: null,
          submitted_at: null,
          reviewed_at: null,
          elapsed_seconds: null,
          remaining_seconds: null,
          is_time_expired: false,
          automatic_score_calculated: false,
          updated_at: nowIso,
        })
        .eq("event_id", eventId);
      if (resetError) throw new Error(`RESET_PROGRESS_FAILED:${resetError.message}`);
      resetProgress = (progress ?? []).length;

      const firstIds = [...(progress ?? []).reduce((firstByTable, row) => {
        if (!firstByTable.has(row.table_id as string)) firstByTable.set(row.table_id as string, row.id as string);
        return firstByTable;
      }, new Map<string, string>()).values()];
      const { error: readyError } = await admin
        .from("captains_table_challenges")
        .update({ status: "ready", updated_at: nowIso })
        .eq("event_id", eventId)
        .in("id", firstIds);
      if (readyError) throw new Error(`READY_FIRST_CHALLENGE_FAILED:${readyError.message}`);
    }

    // 5. Reset tables (names, captains and avatars untouched).
    const { data: resetTables, error: resetTablesError } = await admin
      .from("captains_tables")
      .update({
        total_points: 0,
        completed_challenges: 0,
        failed_challenges: 0,
        current_challenge_id: null,
        last_activity_at: null,
        updated_at: nowIso,
      })
      .eq("event_id", eventId)
      .select("id");
    if (resetTablesError) throw new Error(`RESET_TABLES_FAILED:${resetTablesError.message}`);

    // 6. Clear host interventions so they can show again.
    const { data: deletedInterventions, error: interventionsError } = await admin
      .from("captains_host_interventions")
      .delete()
      .eq("event_id", eventId)
      .select("id");
    if (interventionsError) throw new Error(`DELETE_INTERVENTIONS_FAILED:${interventionsError.message}`);

    return json({
      success: true,
      eventId,
      slug: DEMO_SLUG,
      deletedObjects,
      deletedEvidence: deletedEvidence?.length ?? 0,
      resetProgress,
      resetTables: resetTables?.length ?? 0,
      deletedInterventions: deletedInterventions?.length ?? 0,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("purge-captains-demo-evidence failed:", detail);
    return json({ error: "RESET_FAILED", detail }, 500);
  }
});
