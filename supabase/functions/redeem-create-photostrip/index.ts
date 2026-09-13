import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const DEFAULT_LOGO_URL = "https://acceso.revelao.cam/LogoMiniRevelao.svg";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) return json({ error: "MISSING_ENV" }, 500);

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "LOGIN_REQUIRED" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "LOGIN_REQUIRED" }, 401);

    const payload = await req.json().catch(() => ({}));
    const token = String(payload?.token || "").trim().toUpperCase();
    const event = payload?.event as Record<string, unknown> | undefined;
    const config = payload?.config as Record<string, unknown> | undefined;
    if (!token || !event || !config) return json({ error: "INVALID_PAYLOAD" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: purchase, error: purchaseError } = await admin.from("purchases")
      .select("*").eq("redeem_token", token).maybeSingle();
    if (purchaseError || !purchase) return json({ error: "INVALID_TOKEN" }, 404);
    if (purchase.status !== "paid" || purchase.redeemed_at) return json({ error: "TOKEN_NOT_ACTIVE" }, 409);
    if (purchase.redeem_token_expires_at && new Date(purchase.redeem_token_expires_at).getTime() < Date.now()) {
      return json({ error: "TOKEN_EXPIRED" }, 410);
    }
    if (purchase.user_id && purchase.user_id !== user.id) return json({ error: "ACCOUNT_MISMATCH" }, 403);
    if (purchase.user_email && purchase.user_email.toLowerCase() !== user.email?.toLowerCase()) return json({ error: "ACCOUNT_MISMATCH" }, 403);

    const plan = getPlanById(purchase.plan_id);
    if (!plan || plan.product !== "photostrip") return json({ error: "INVALID_PLAN" }, 400);

    const name = String(event.name || "").trim().slice(0, 200);
    const slug = String(config.slug || "").trim().slice(0, 60);
    const uploadStart = new Date(String(event.upload_start_time || ""));
    const uploadEnd = new Date(String(event.upload_end_time || ""));
    const photoMode = String(config.photo_mode || "both");
    const galleryVisibility = String(config.gallery_visibility || "participants");
    if (!name || !slugPattern.test(slug) || Number.isNaN(uploadStart.getTime()) || Number.isNaN(uploadEnd.getTime()) || uploadEnd <= uploadStart) {
      return json({ error: "INVALID_EVENT" }, 400);
    }
    if (!["color", "bw", "both"].includes(photoMode) || !["public", "participants", "admin_only"].includes(galleryVisibility)) {
      return json({ error: "INVALID_CONFIG" }, 400);
    }

    const { data: createdEvent, error: eventError } = await admin.from("events").insert({
      name,
      password_hash: `photostrip-${crypto.randomUUID()}`,
      upload_start_time: uploadStart.toISOString(),
      upload_end_time: uploadEnd.toISOString(),
      reveal_time: uploadEnd.toISOString(),
      timezone: typeof event.timezone === "string" ? event.timezone : "Europe/Madrid",
      type: "photostrip",
      plan_id: plan.id,
      is_demo: false,
      max_photos: 0,
      allow_video_recording: false,
      allow_audio_recording: false,
      country_code: "ES",
      language: "es",
      show_legal_text: false,
      owner_id: user.id,
      limits_json: { photostrip: { plan_id: plan.id, max_strips: plan.maxStrips } },
    }).select("id").single();
    if (eventError || !createdEvent) return json({ error: "CREATE_EVENT_FAILED", detail: eventError?.message }, 500);

    const { error: configError } = await admin.from("photostrip_event_configs").insert({
      event_id: createdEvent.id,
      slug,
      enabled: config.enabled !== false,
      photo_count: 4,
      countdown_seconds: 3,
      photo_mode: photoMode,
      gallery_visibility: galleryVisibility,
      strip_template: "classic",
      strip_display_name: String(config.strip_display_name || "").trim() || null,
      strip_footer_text: String(config.strip_footer_text || "").trim() || null,
      logo_url: String(config.logo_url || "").trim() || DEFAULT_LOGO_URL,
      max_strips: plan.maxStrips,
    });
    if (configError) {
      await admin.from("events").delete().eq("id", createdEvent.id);
      return json({ error: "CREATE_CONFIG_FAILED", detail: configError.message }, 500);
    }

    const { data: redeemed, error: redeemError } = await admin.from("purchases").update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email?.trim().toLowerCase() || purchase.user_email,
    }).eq("id", purchase.id).eq("status", "paid").is("redeemed_at", null).select("id").maybeSingle();
    if (redeemError || !redeemed) {
      await admin.from("events").delete().eq("id", createdEvent.id);
      return json({ error: "TOKEN_ALREADY_USED" }, 409);
    }

    return json({ eventId: createdEvent.id, plan: { id: plan.id, label: plan.label, maxStrips: plan.maxStrips } });
  } catch (error) {
    console.error("redeem-create-photostrip error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
