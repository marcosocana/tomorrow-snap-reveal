import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById, type PlanConfig, type PlanId } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return json({ error: "MISSING_TOKEN" }, 400);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin
    .from("purchases")
    .select("*")
    .eq("redeem_token", token)
    .maybeSingle();

  if (error || !data) {
    return json({ error: "INVALID_TOKEN" }, 404);
  }

  if (data.status !== "paid") {
    return json({ error: "TOKEN_NOT_ACTIVE" }, 409);
  }
  if (data.redeem_token_expires_at && new Date(data.redeem_token_expires_at) < new Date()) {
    return json({ error: "TOKEN_EXPIRED" }, 410);
  }

  let plan = getPlanById(data.plan_id);
  if (!plan) {
    const fallbackPlans: Record<string, PlanConfig> = {
      demo: { id: "demo", label: "Demo", maxPhotos: 10, maxVideos: 3, maxAudios: 6, stripePriceIdEnv: "STRIPE_PRICE_DEMO" },
      small: { id: "small", label: "Start", maxPhotos: 200, maxVideos: 30, maxAudios: 60, stripePriceIdEnv: "STRIPE_PRICE_SMALL" },
      medium: { id: "medium", label: "Plus", maxPhotos: 1200, maxVideos: 90, maxAudios: 200, stripePriceIdEnv: "STRIPE_PRICE_MEDIUM" },
      large: { id: "large", label: "Plus", maxPhotos: 1200, maxVideos: 90, maxAudios: 200, stripePriceIdEnv: "STRIPE_PRICE_LARGE" },
      xxl: { id: "xxl", label: "Pro", maxPhotos: null, maxVideos: null, maxAudios: null, stripePriceIdEnv: "STRIPE_PRICE_XXL" },
      xl: { id: "xxl" as PlanId, label: "Pro", maxPhotos: null, maxVideos: null, maxAudios: null, stripePriceIdEnv: "STRIPE_PRICE_XXL" },
    };
    plan = fallbackPlans[data.plan_id ?? ""] ?? null;
  }
  return json({
    token,
    plan,
    status: data.status,
    expiresAt: data.redeem_token_expires_at,
    userEmail: data.user_email ?? null,
  });
});
