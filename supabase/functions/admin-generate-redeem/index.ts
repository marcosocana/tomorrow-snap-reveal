import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

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

const generateRedeemToken = (length = 16) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += alphabet[values[i] % alphabet.length];
  }
  return token;
};

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

  const payload = await req.json().catch(() => ({}));
  const planId = payload?.planId as string | undefined;
  let plan = getPlanById(planId);
  if (!plan && planId === "demo") {
    plan = { id: "demo", label: "Demo", maxPhotos: 10, stripePriceIdEnv: "STRIPE_PRICE_DEMO" };
  }
  if (!plan) {
    return json({ error: "INVALID_PLAN" }, 400);
  }

  const redeemToken = generateRedeemToken(16);
  const redeemExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin
    .from("purchases")
    .insert({
      user_id: null,
      user_email: null,
      stripe_session_id: null,
      plan_id: plan.id,
      status: "paid",
      redeem_token: redeemToken,
      redeem_token_expires_at: redeemExpiresAt,
      redeemed_at: null,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("admin-generate-redeem error:", error);
    return json({ error: "DB_ERROR" }, 500);
  }

  return json({
    token: data?.redeem_token ?? redeemToken,
    plan,
    expiresAt: data?.redeem_token_expires_at ?? redeemExpiresAt,
  });
});
