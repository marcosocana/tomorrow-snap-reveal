import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DEFAULT_LOGO_URL = "https://acceso.revelao.cam/LogoMiniRevelao.svg";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
});

const slugify = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "SERVER_CONFIGURATION" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return json({ error: "LOGIN_REQUIRED" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "LOGIN_REQUIRED" }, 401);

  const payload = await req.json().catch(() => ({})) as Record<string, unknown>;
  const redeemToken = String(payload?.token || "").trim().toUpperCase();
  const eventName = String(payload?.eventName || "").trim().slice(0, 200);
  const footer = String(payload?.stripFooterText || "").trim().slice(0, 120) || null;
  const photoMode = ["color", "bw", "both"].includes(String(payload?.photoMode || ""))
    ? String(payload?.photoMode)
    : "both";
  const timezone = String(payload?.timezone || "Europe/Madrid").trim().slice(0, 80);
  const galleryVisibility = payload?.galleryVisibility === "private" ? "private" : "public";
  let coverImageUrl: string | null = null;
  if (payload?.coverImageUrl) {
    try {
      const parsed = new URL(String(payload.coverImageUrl));
      if (!["http:", "https:"].includes(parsed.protocol)) return json({ error: "INVALID_COVER" }, 400);
      coverImageUrl = parsed.toString();
    } catch {
      return json({ error: "INVALID_COVER" }, 400);
    }
  }
  if (!redeemToken) return json({ error: "INVALID_TOKEN" }, 400);
  if (!eventName) return json({ error: "INVALID_EVENT" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: purchase, error: purchaseError } = await admin.from("purchases")
    .select("*").eq("redeem_token", redeemToken).maybeSingle();
  if (purchaseError || !purchase) return json({ error: "INVALID_TOKEN" }, 404);
  if (purchase.status !== "paid" || purchase.redeemed_at) return json({ error: "TOKEN_NOT_ACTIVE" }, 409);
  if (purchase.redeem_token_expires_at && new Date(purchase.redeem_token_expires_at).getTime() < Date.now()) {
    return json({ error: "TOKEN_EXPIRED" }, 410);
  }

  const userEmail = user.email?.trim().toLowerCase() || "";
  const purchaseEmail = purchase.user_email?.trim().toLowerCase() || null;
  if (purchase.user_id) {
    if (purchase.user_id !== user.id) return json({ error: "ACCOUNT_MISMATCH" }, 403);
  } else if (!purchaseEmail || purchaseEmail !== userEmail) {
    return json({ error: "ACCOUNT_MISMATCH" }, 403);
  }

  const plan = getPlanById(purchase.plan_id);
  if (!plan || plan.product !== "photostrip") return json({ error: "INVALID_PLAN" }, 400);
  const maxStrips = plan.maxStrips ?? null;

  const now = new Date();
  const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const { data: event, error: eventError } = await admin.from("events").insert({
    name: eventName,
    password_hash: `photostrip-${crypto.randomUUID()}`,
    admin_password: purchase.redeem_token,
    upload_start_time: new Date(now.getTime() - 60_000).toISOString(),
    upload_end_time: endsAt.toISOString(),
    reveal_time: endsAt.toISOString(),
    max_photos: 0,
    allow_video_recording: false,
    allow_audio_recording: false,
    background_image_url: coverImageUrl,
    timezone,
    country_code: "ES",
    language: "es",
    type: "photostrip",
    plan_id: plan.id,
    is_demo: false,
    owner_id: user.id,
    show_legal_text: false,
    limits_json: {
      max_photostrips: maxStrips,
      created_from: "photostrip_purchase",
    },
  }).select("id,name,type,plan_id").single();
  if (eventError || !event) return json({ error: "CREATE_EVENT_FAILED", detail: eventError?.message }, 500);

  const slug = `${slugify(eventName) || "photostrip"}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const { error: configError } = await admin.from("photostrip_event_configs").insert({
    event_id: event.id,
    slug,
    enabled: true,
    photo_count: 4,
    countdown_seconds: 3,
    photo_mode: photoMode,
    gallery_visibility: galleryVisibility,
    strip_template: "classic",
    strip_display_name: eventName,
    strip_footer_text: footer,
    logo_url: DEFAULT_LOGO_URL,
    max_strips: maxStrips,
  });
  if (configError) {
    await admin.from("events").delete().eq("id", event.id);
    return json({ error: "CREATE_CONFIG_FAILED", detail: configError.message }, 500);
  }

  const { error: redeemError } = await admin.from("purchases").update({
    status: "redeemed",
    redeemed_at: new Date().toISOString(),
    user_id: purchase.user_id || user.id,
    user_email: purchase.user_email || userEmail,
  }).eq("id", purchase.id).is("redeemed_at", null);
  if (redeemError) {
    await admin.from("photostrip_event_configs").delete().eq("event_id", event.id);
    await admin.from("events").delete().eq("id", event.id);
    return json({ error: "REDEEM_FAILED", detail: redeemError.message }, 500);
  }

  return json({
    event: { id: event.id, name: event.name },
    slug,
    eventUrl: `https://acceso.revelao.cam/photostrip/${slug}`,
    maxStrips,
    planLabel: plan.label,
  });
});
