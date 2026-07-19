import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";
const EVIDENCE_BUCKET = "captains-evidence";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const storagePathFromValue = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value.trim();
  if (!/^https?:\/\//i.test(clean)) return clean.replace(/^\/+/, "").replace(new RegExp(`^${EVIDENCE_BUCKET}/`), "");
  try {
    const pathname = decodeURIComponent(new URL(clean).pathname);
    const markers = [
      `/storage/v1/object/public/${EVIDENCE_BUCKET}/`,
      `/storage/v1/object/sign/${EVIDENCE_BUCKET}/`,
      `/storage/v1/object/${EVIDENCE_BUCKET}/`,
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    return marker ? pathname.slice(pathname.indexOf(marker) + marker.length) : null;
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "MISSING_SUPABASE_ENV" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === "all" ? "all" : "table";
    const requestedTableId = typeof body?.tableId === "string" ? body.tableId.trim() : "";
    let eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
    const accessCode = typeof body?.accessCode === "string" ? body.accessCode.trim().toUpperCase() : "";
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    if (action === "table") {
      if (!requestedTableId) return json({ error: "TABLE_ID_REQUIRED" }, 400);
      const { data: requestedTable, error: tableError } = await admin
        .from("captains_tables")
        .select("id,event_id")
        .eq("id", requestedTableId)
        .maybeSingle();
      if (tableError) return json({ error: "LOAD_TABLE_FAILED", detail: tableError.message }, 500);
      if (!requestedTable) return json({ error: "TABLE_NOT_FOUND" }, 404);
      eventId = requestedTable.event_id;
    } else if (!eventId) {
      return json({ error: "EVENT_ID_REQUIRED" }, 400);
    }

    const { data: captainsEvent, error: eventError } = await admin
      .from("captains_events")
      .select("id,owner_id")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError) return json({ error: "LOAD_EVENT_FAILED", detail: eventError.message }, 500);
    if (!captainsEvent) return json({ error: "EVENT_NOT_FOUND" }, 404);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let user: { id: string; email?: string } | null = null;
    if (token) {
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data } = await authClient.auth.getUser(token);
      user = data.user ? { id: data.user.id, email: data.user.email } : null;
    }

    let hasCodeAccess = false;
    if (accessCode) {
      const { data: codeRow } = await admin
        .from("captains_creation_codes")
        .select("event_id,redeemed_at,expires_at")
        .eq("code", accessCode)
        .maybeSingle();
      hasCodeAccess = Boolean(
        codeRow?.redeemed_at
        && codeRow.event_id === eventId
        && new Date(codeRow.expires_at).getTime() > Date.now(),
      );
    }

    const isSuperAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
    const isOwner = Boolean(user && captainsEvent.owner_id && captainsEvent.owner_id === user.id);
    if (!isSuperAdmin && !isOwner && !hasCodeAccess) return json({ error: "FORBIDDEN" }, 403);

    let tablesQuery = admin
      .from("captains_tables")
      .select("id")
      .eq("event_id", eventId);
    if (action === "table") tablesQuery = tablesQuery.eq("id", requestedTableId);
    const { data: tables, error: tablesError } = await tablesQuery.order("table_number", { ascending: true });
    if (tablesError) return json({ error: "LOAD_TABLES_FAILED", detail: tablesError.message }, 500);

    for (const table of tables || []) {
      const { data: evidence, error: evidenceError } = await admin
        .from("captains_evidence")
        .select("id,file_url")
        .eq("table_id", table.id);
      if (evidenceError) return json({ error: "LOAD_EVIDENCE_FAILED", detail: evidenceError.message }, 500);

      const storagePaths = [...new Set((evidence || [])
        .map((row) => storagePathFromValue(row.file_url))
        .filter((path): path is string => Boolean(path)))];
      if (storagePaths.length) {
        const { error: storageError } = await admin.storage.from(EVIDENCE_BUCKET).remove(storagePaths);
        if (storageError) return json({ error: "DELETE_STORAGE_FAILED", detail: storageError.message }, 500);
      }

      const { error: deleteEvidenceError } = await admin.from("captains_evidence").delete().eq("table_id", table.id);
      if (deleteEvidenceError) return json({ error: "DELETE_EVIDENCE_FAILED", detail: deleteEvidenceError.message }, 500);

      const { data: challenges, error: challengesError } = await admin
        .from("captains_table_challenges")
        .select("id")
        .eq("table_id", table.id)
        .order("randomized_order_index", { ascending: true });
      if (challengesError) return json({ error: "LOAD_CHALLENGES_FAILED", detail: challengesError.message }, 500);
      const challengeIds = (challenges || []).map((row) => row.id);
      if (challengeIds.length) {
        const { error: resetError } = await admin.from("captains_table_challenges").update({
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
        }).in("id", challengeIds);
        if (resetError) return json({ error: "RESET_CHALLENGES_FAILED", detail: resetError.message }, 500);
        const { error: readyError } = await admin
          .from("captains_table_challenges")
          .update({ status: "ready" })
          .eq("id", challengeIds[0]);
        if (readyError) return json({ error: "READY_FIRST_CHALLENGE_FAILED", detail: readyError.message }, 500);
      }

      const { error: resetTableError } = await admin.from("captains_tables").update({
        total_points: 0,
        completed_challenges: 0,
        failed_challenges: 0,
        current_challenge_id: null,
        completed_at: null,
        last_activity_at: null,
        claimed_at: null,
        claim_device_hash: null,
      }).eq("id", table.id);
      if (resetTableError) return json({ error: "RESET_TABLE_FAILED", detail: resetTableError.message }, 500);
    }

    return json({ success: true, resetTableIds: (tables || []).map((table) => table.id) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("reset-captains-tables unexpected error:", error);
    return json({ error: "UNEXPECTED_ERROR", detail }, 500);
  }
});
