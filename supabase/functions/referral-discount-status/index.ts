import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check by referred_user_id
    const { data: byId } = await supabaseAdmin
      .from("referral_attributions")
      .select("id")
      .eq("referred_user_id", userId)
      .limit(1)
      .maybeSingle();

    let eligible = Boolean(byId?.id);

    // Fallback: check by referred_email (case-insensitive)
    if (!eligible && userEmail) {
      const { data: byEmail } = await supabaseAdmin
        .from("referral_attributions")
        .select("id")
        .ilike("referred_email", userEmail)
        .limit(1)
        .maybeSingle();

      eligible = Boolean(byEmail?.id);
    }

    return json({
      eligible,
      discountPercent: eligible ? 30 : 0,
      excludedPlans: ["small"],
    });
  } catch (error) {
    console.error("referral-discount-status error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
