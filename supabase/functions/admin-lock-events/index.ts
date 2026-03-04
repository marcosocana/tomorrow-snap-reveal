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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  if (req.method !== "POST") {
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

  let payload: { eventIds?: string[]; pin?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "INVALID_BODY" }, 400);
  }

  const eventIds = Array.isArray(payload.eventIds) ? payload.eventIds.filter(Boolean) : [];
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : "";

  if (eventIds.length === 0 || !pin) {
    return json({ error: "MISSING_DATA" }, 400);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: events, error: loadError } = await supabaseAdmin
      .from("events")
      .select("id, limits_json")
      .in("id", eventIds);

    if (loadError) {
      return json({ error: "LOAD_FAILED", detail: loadError.message }, 500);
    }

    for (const event of events ?? []) {
      let currentLimits: Record<string, unknown> = {};
      if (typeof event.limits_json === "string") {
        try {
          const parsed = JSON.parse(event.limits_json);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            currentLimits = parsed as Record<string, unknown>;
          }
        } catch {
          currentLimits = {};
        }
      } else if (event.limits_json && typeof event.limits_json === "object" && !Array.isArray(event.limits_json)) {
        currentLimits = event.limits_json as Record<string, unknown>;
      }

      const { error: updateError } = await supabaseAdmin
        .from("events")
        .update({
          limits_json: {
            ...currentLimits,
            deletion_lock_pin: pin,
          },
        })
        .eq("id", event.id);

      if (updateError) {
        return json({ error: "UPDATE_FAILED", detail: updateError.message }, 500);
      }
    }

    return json({ success: true, updated: events?.length ?? 0 });
  } catch (error) {
    console.error("admin-lock-events error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
