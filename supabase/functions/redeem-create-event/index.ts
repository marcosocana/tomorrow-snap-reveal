import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

type PaidEventPayload = {
  token: string;
  event: {
    name: string;
    password_hash: string;
    admin_password: string;
    upload_start_time: string;
    upload_end_time: string;
    reveal_time: string;
    custom_image_url?: string | null;
    background_image_url?: string | null;
    filter_type?: string | null;
    font_family?: string | null;
    font_size?: string | null;
    country_code?: string | null;
    timezone?: string | null;
    language?: string | null;
    description?: string | null;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const tokenAuth = authHeader.replace("Bearer ", "").trim();
  if (!tokenAuth) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  try {
    const payload = (await req.json()) as PaidEventPayload;
    const redeemToken = payload?.token;
    const event = payload?.event;
    if (!redeemToken || !event?.name) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(
      tokenAuth,
    );
    if (userError || !userData?.user) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("*")
      .eq("redeem_token", redeemToken)
      .maybeSingle();

    if (purchaseError || !purchase) {
      return json({ error: "INVALID_TOKEN" }, 404);
    }
    if (purchase.status !== "paid") {
      return json({ error: "TOKEN_NOT_ACTIVE" }, 409);
    }
    if (
      purchase.redeem_token_expires_at &&
      new Date(purchase.redeem_token_expires_at) < new Date()
    ) {
      return json({ error: "TOKEN_EXPIRED" }, 410);
    }

    const plan = getPlanById(purchase.plan_id);
    if (!plan) {
      return json({ error: "INVALID_PLAN" }, 400);
    }

    const maxPhotos = plan.maxPhotos;

    const { data: createdEvent, error: eventError } = await supabaseAdmin
      .from("events")
      .insert({
        name: event.name,
        password_hash: event.password_hash,
        admin_password: event.admin_password,
        upload_start_time: event.upload_start_time,
        upload_end_time: event.upload_end_time,
        reveal_time: event.reveal_time,
        max_photos: maxPhotos,
        custom_image_url: event.custom_image_url ?? null,
        background_image_url: event.background_image_url ?? null,
        filter_type: event.filter_type ?? "none",
        font_family: event.font_family ?? "system",
        font_size: event.font_size ?? "text-3xl",
        is_demo: false,
        type: "paid",
        plan_id: plan.id,
        limits_json: { max_photos: maxPhotos },
        country_code: event.country_code ?? "ES",
        timezone: event.timezone ?? "Europe/Madrid",
        language: event.language ?? "es",
        description: event.description ?? null,
        expiry_date: null,
        expiry_redirect_url: null,
        allow_photo_deletion: true,
        show_legal_text: true,
        owner_id: userData.user.id,
      })
      .select()
      .single();

    if (eventError || !createdEvent) {
      return json({ error: "CREATE_EVENT_FAILED" }, 500);
    }

    await supabaseAdmin
      .from("purchases")
      .update({
        status: "redeemed",
        redeemed_at: new Date().toISOString(),
        user_id: userData.user.id,
      })
      .eq("id", purchase.id);

    return json({ event: createdEvent });
  } catch (error) {
    console.error("redeem-create-event error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
