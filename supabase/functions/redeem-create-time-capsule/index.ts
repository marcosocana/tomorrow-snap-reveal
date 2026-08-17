import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: "MISSING_ENV" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

  const payload = await req.json().catch(() => ({}));
  const redeemToken = String(payload?.token || "").trim().toUpperCase();
  const event = payload?.event as Record<string, unknown> | undefined;
  if (!redeemToken || !event || typeof event.name !== "string") return json({ error: "INVALID_PAYLOAD" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: purchase, error: purchaseError } = await admin.from("purchases")
    .select("*").eq("redeem_token", redeemToken).maybeSingle();
  if (purchaseError || !purchase) return json({ error: "INVALID_TOKEN" }, 404);
  if (purchase.status !== "paid" || purchase.redeemed_at) return json({ error: "TOKEN_NOT_ACTIVE" }, 409);
  if (purchase.redeem_token_expires_at && new Date(purchase.redeem_token_expires_at).getTime() < Date.now()) {
    return json({ error: "TOKEN_EXPIRED" }, 410);
  }
  if (purchase.user_id && purchase.user_id !== user.id) return json({ error: "ACCOUNT_MISMATCH" }, 403);

  const plan = getPlanById(purchase.plan_id);
  if (!plan || plan.product !== "capsule") return json({ error: "INVALID_PLAN" }, 400);
  const uploadStart = new Date(String(event.upload_start_time || ""));
  const uploadEnd = new Date(String(event.upload_end_time || ""));
  const password = String(event.password_hash || "");
  if (
    !String(event.name).trim() || password.length < 8 ||
    Number.isNaN(uploadStart.getTime()) || Number.isNaN(uploadEnd.getTime()) || uploadEnd <= uploadStart
  ) {
    return json({ error: "INVALID_EVENT" }, 400);
  }

  const currentLimits = event.limits_json && typeof event.limits_json === "object" && !Array.isArray(event.limits_json)
    ? event.limits_json as Record<string, unknown>
    : {};
  const capsuleLimits = currentLimits.capsule && typeof currentLimits.capsule === "object" && !Array.isArray(currentLimits.capsule)
    ? currentLimits.capsule as Record<string, unknown>
    : {};
  const maxMessages = plan.maxVideos;
  const limitsJson = {
    ...currentLimits,
    max_videos: maxMessages,
    capsule: {
      ...capsuleLimits,
      plan_id: plan.id,
      max_messages: maxMessages,
    },
  };

  const { data: createdEvent, error: eventError } = await admin.from("events").insert({
    name: String(event.name).trim(),
    description: typeof event.description === "string" ? event.description.trim() || null : null,
    font_family: typeof event.font_family === "string" ? event.font_family : "system",
    custom_image_url: typeof event.custom_image_url === "string" ? event.custom_image_url || null : null,
    password_hash: password,
    admin_password: String(event.admin_password || password),
    upload_start_time: uploadStart.toISOString(),
    upload_end_time: uploadEnd.toISOString(),
    reveal_time: uploadEnd.toISOString(),
    hide_reveal_date: false,
    expiry_date: null,
    max_photos: 0,
    allow_video_recording: true,
    max_videos: maxMessages ?? 0,
    max_video_duration: 60,
    allow_audio_recording: false,
    max_audios: 0,
    allow_image_attachment: false,
    allow_video_attachment: false,
    is_demo: false,
    type: "capsule",
    plan_id: "capsule",
    timezone: typeof event.timezone === "string" ? event.timezone : "Europe/Madrid",
    country_code: "ES",
    language: "es",
    limits_json: limitsJson,
    owner_id: user.id,
  }).select().single();
  if (eventError || !createdEvent) return json({ error: "CREATE_EVENT_FAILED", detail: eventError?.message }, 500);

  const { data: redeemed, error: redeemError } = await admin.from("purchases").update({
    status: "redeemed",
    redeemed_at: new Date().toISOString(),
    user_id: user.id,
    user_email: user.email ?? purchase.user_email ?? null,
  }).eq("id", purchase.id).eq("status", "paid").is("redeemed_at", null).select("id").maybeSingle();
  if (redeemError || !redeemed) {
    await admin.from("events").delete().eq("id", createdEvent.id);
    return json({ error: "TOKEN_ALREADY_USED" }, 409);
  }

  return json({
    event: { ...createdEvent, owner_email: user.email ?? purchase.user_email ?? null },
    plan: { id: plan.id, label: plan.label, maxMessages },
  });
});
