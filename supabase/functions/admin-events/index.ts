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
    headers: { "Content-Type": "application/json", ...corsHeaders },
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
      .select("id,name,password_hash,max_photos,upload_start_time,upload_end_time,reveal_time,created_at,owner_id")
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

    let emailsById: Record<string, string> = {};
    let phonesById: Record<string, string | null> = {};

    if (ownerIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .schema("auth")
        .from("users")
        .select("id,email")
        .in("id", ownerIds);

      (users || []).forEach((u) => {
        emailsById[u.id] = u.email;
      });

      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id,phone")
        .in("id", ownerIds);

      (profiles || []).forEach((p) => {
        phonesById[p.id] = p.phone ?? null;
      });
    }

    const enriched = (events || []).map((event) => ({
      ...event,
      owner_email: event.owner_id ? emailsById[event.owner_id] ?? null : null,
      owner_phone: event.owner_id ? phonesById[event.owner_id] ?? null : null,
    }));

    return json({ events: enriched });
  } catch (error) {
    console.error("admin-events error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
