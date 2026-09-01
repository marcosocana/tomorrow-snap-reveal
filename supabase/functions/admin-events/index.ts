import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...corsHeaders,
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: "Missing Supabase env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  const email = user.email?.toLowerCase() ?? "";
  if (email !== ADMIN_EMAIL) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");

    const baseQuery = supabaseAdmin
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: events, error: eventsError } = eventId
      ? await baseQuery.eq("id", eventId)
      : await baseQuery;

    if (eventsError) {
      return json({ error: "LOAD_FAILED", detail: eventsError.message }, 500);
    }

    const ownerIds = Array.from(
      new Set((events || []).map((e) => e.owner_id).filter(Boolean)),
    ) as string[];

    const emailsById: Record<string, string> = {};
    const phonesById: Record<string, string | null> = {};
    const photoCounts: Record<string, number> = {};
    const videoCounts: Record<string, number> = {};
    const audioCounts: Record<string, number> = {};
    if (ownerIds.length > 0) {
      const { data: usersData, error: usersError } =
        await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

      if (!usersError && usersData?.users) {
        usersData.users.forEach((u) => {
          if (u.id) emailsById[u.id] = u.email ?? "";
        });
      }

      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id,phone")
        .in("id", ownerIds);

      (profiles || []).forEach((p) => {
        phonesById[p.id] = p.phone ?? null;
      });
    }

    const eventIds = (events || []).map((e) => e.id);
    if (eventIds.length > 0) {
      const { data: countsData, error: countsError } = await supabaseAdmin.rpc(
        "get_event_media_counts_batch",
        { target_event_ids: eventIds },
      );

      if (countsError) {
        return json({ error: "LOAD_COUNTS_FAILED", detail: countsError.message }, 500);
      }

      for (const row of countsData || []) {
        const id = row.event_id as string;
        photoCounts[id] = Number(row.photo_count ?? 0);
        videoCounts[id] = Number(row.video_count ?? 0);
        audioCounts[id] = Number(row.audio_count ?? 0);
      }
    }

    const enriched = (events || []).map((event) => ({
      ...event,
      owner_email: event.owner_id ? emailsById[event.owner_id] ?? null : null,
      owner_phone: event.owner_id ? phonesById[event.owner_id] ?? null : null,
      photo_count: photoCounts[event.id] ?? 0,
      video_count: videoCounts[event.id] ?? 0,
      audio_count: audioCounts[event.id] ?? 0,
    }));

    const { data: captainsEvents, error: captainsError } = await supabaseAdmin
      .from("captains_events")
      .select("*")
      .order("created_at", { ascending: false });
    if (captainsError) {
      return json({ error: "LOAD_CAPTAINS_FAILED", detail: captainsError.message }, 500);
    }

    const captainsIds = (captainsEvents || []).map((event) => event.id);
    const tableCounts: Record<string, number> = {};
    const challengeCounts: Record<string, number> = {};
    if (captainsIds.length > 0) {
      const [tablesResult, challengesResult] = await Promise.all([
        supabaseAdmin.from("captains_tables").select("event_id").in("event_id", captainsIds),
        supabaseAdmin.from("captains_event_challenges").select("event_id").in("event_id", captainsIds),
      ]);
      for (const row of tablesResult.data || []) {
        tableCounts[row.event_id] = (tableCounts[row.event_id] || 0) + 1;
      }
      for (const row of challengesResult.data || []) {
        challengeCounts[row.event_id] = (challengeCounts[row.event_id] || 0) + 1;
      }
    }

    const enrichedCaptains = (captainsEvents || []).map((event) => ({
      ...event,
      owner_email: event.contact_email || (event.owner_id ? emailsById[event.owner_id] ?? null : null),
      owner_phone: event.contact_phone || (event.owner_id ? phonesById[event.owner_id] ?? null : null),
      table_count: tableCounts[event.id] || 0,
      challenge_count: challengeCounts[event.id] || 0,
    }));

    return json({ events: enriched, captainsEvents: enrichedCaptains });
  } catch (error) {
    console.error("admin-events error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
