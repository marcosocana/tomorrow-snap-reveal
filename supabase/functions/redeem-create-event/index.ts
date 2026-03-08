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
  contactEmail?: string;
  password?: string;
  phone?: string | null;
  marketingConsent?: boolean;
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
    expiry_redirect_url?: string | null;
  };
};

const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

  try {
    const payload = (await req.json()) as PaidEventPayload;
    const redeemToken = payload?.token;
    const event = payload?.event;
    if (!redeemToken || !event?.name) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const tokenAuth = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

    let ownerId: string | null = null;
    let ownerEmail: string | null = null;
    let contactPhone: string | null = payload?.phone?.trim() || null;
    const marketingConsent = payload?.marketingConsent ?? true;

    if (tokenAuth) {
      const { data: userData, error: userError } = await supabase.auth.getUser(
        tokenAuth,
      );
      if (userError || !userData?.user) {
        return json({ error: "UNAUTHORIZED" }, 401);
      }
      ownerId = userData.user.id;
      ownerEmail = userData.user.email ?? purchase.user_email ?? null;
    } else {
      const email = payload?.contactEmail?.trim().toLowerCase() ?? "";
      const password = payload?.password ?? "";
      if (!email || !isEmail(email)) {
        return json({ error: "INVALID_EMAIL" }, 400);
      }
      if (!password || password.length < 8) {
        return json({ error: "INVALID_PASSWORD" }, 400);
      }
      const purchaseEmail = purchase.user_email?.trim().toLowerCase() ?? null;
      if (purchaseEmail && email !== purchaseEmail) {
        return json({ error: "EMAIL_MISMATCH" }, 409);
      }

      const { data: existingAuthUser, error: existingUserError } = await supabaseAdmin
        .schema("auth")
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingUserError) {
        console.error("redeem-create-event user lookup error:", existingUserError.message);
        return json({ error: "USER_LOOKUP_FAILED" }, 500);
      }
      if (existingAuthUser?.id) {
        return json({ error: "USER_EXISTS_LOGIN_REQUIRED" }, 409);
      }

      const { data: createdUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createUserError || !createdUser?.user?.id) {
        return json({ error: "CREATE_USER_FAILED", detail: createUserError?.message ?? "unknown_error" }, 500);
      }

      ownerId = createdUser.user.id;
      ownerEmail = email;
    }

    if (!ownerId) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    if (contactPhone) {
      const { error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .upsert(
          {
            id: ownerId,
            phone: contactPhone,
            marketing_opt_in: marketingConsent,
          },
          { onConflict: "id" },
        );
      if (profileError) {
        return json({ error: "CREATE_PROFILE_FAILED", detail: profileError.message }, 500);
      }
    }

    const maxPhotos = plan.maxPhotos;
    const maxVideos = plan.maxVideos;
    const maxAudios = plan.maxAudios;
    const allowVideoRecording = maxVideos !== 0;
    const allowAudioRecording = maxAudios !== 0;

    const revealBase = new Date(event.reveal_time);
    const expiryDate = new Date(revealBase);
    const expiryDays =
      plan?.maxPhotos === 10 ? 10 :
      plan?.maxPhotos === 200 ? 20 :
      plan?.maxPhotos === 1200 ? 60 :
      90;
    expiryDate.setUTCDate(expiryDate.getUTCDate() + expiryDays);
    expiryDate.setUTCHours(23, 59, 0, 0);

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
        allow_video_recording: allowVideoRecording,
        max_videos: allowVideoRecording ? (maxVideos ?? 0) : 0,
        max_video_duration: 15,
        allow_audio_recording: allowAudioRecording,
        max_audios: allowAudioRecording ? (maxAudios ?? 0) : 0,
        max_audio_duration: 30,
        custom_image_url: event.custom_image_url ?? null,
        background_image_url: event.background_image_url ?? null,
        filter_type: event.filter_type ?? "none",
        font_family: event.font_family ?? "system",
        font_size: event.font_size ?? "text-3xl",
        is_demo: false,
        type: "paid",
        plan_id: plan.id,
        limits_json: {
          max_photos: maxPhotos,
          max_videos: maxVideos,
          max_audios: maxAudios,
        },
        country_code: event.country_code ?? "ES",
        timezone: event.timezone ?? "Europe/Madrid",
        language: event.language ?? "es",
        description: event.description ?? null,
        expiry_date: expiryDate.toISOString(),
        expiry_redirect_url: event.expiry_redirect_url ?? null,
        allow_photo_deletion: true,
        show_legal_text: true,
        owner_id: ownerId,
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
        user_id: ownerId,
        user_email: ownerEmail ?? purchase.user_email ?? null,
      })
      .eq("id", purchase.id);

    return json({ event: createdEvent, ownerEmail: ownerEmail ?? null });
  } catch (error) {
    console.error("redeem-create-event error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
