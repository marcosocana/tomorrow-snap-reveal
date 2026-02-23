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

type AdminEventPayload = {
  ownerEmail: string;
  event: {
    name: string;
    password_hash: string;
    admin_password: string;
    upload_start_time: string;
    upload_end_time: string;
    reveal_time: string;
    max_photos: number | null;
    custom_image_url?: string | null;
    background_image_url?: string | null;
    filter_type?: string | null;
    font_family?: string | null;
    font_size?: string | null;
    country_code?: string | null;
    timezone?: string | null;
    language?: string | null;
    description?: string | null;
    expiry_date?: string | null;
    expiry_redirect_url?: string | null;
    allow_photo_deletion?: boolean;
    allow_photo_sharing?: boolean;
    show_legal_text?: boolean;
    legal_text_type?: string | null;
    custom_terms_text?: string | null;
    custom_privacy_text?: string | null;
    gallery_view_mode?: string | null;
    like_counting_enabled?: boolean;
  };
};

const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getPlanMeta = (maxPhotos: number | null | undefined) => {
  if (maxPhotos === 10) return { label: "Evento demo", type: "demo", planId: "demo" };
  if (maxPhotos === 50) return { label: "Evento pequeño", type: "paid", planId: "small" };
  if (maxPhotos === 300) return { label: "Evento mediano", type: "paid", planId: "medium" };
  if (maxPhotos === 500) return { label: "Evento grande", type: "paid", planId: "large" };
  if (maxPhotos === 1000) return { label: "Evento XL", type: "paid", planId: "xl" };
  return { label: "Evento personalizado", type: "paid", planId: "custom" };
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

  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  try {
    const payload = (await req.json()) as AdminEventPayload;
    const ownerEmail = payload?.ownerEmail?.trim().toLowerCase() ?? "";
    const event = payload?.event;

    if (!ownerEmail || !isEmail(ownerEmail)) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }
    if (!event?.name || !event.password_hash || !event.admin_password) {
      return json({ error: "INVALID_EVENT" }, 400);
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: existingUser, error: userLookupError } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id,email")
      .eq("email", ownerEmail)
      .maybeSingle();

    if (userLookupError) {
      return json({ error: "OWNER_LOOKUP_FAILED", detail: userLookupError.message }, 500);
    }

    if (!existingUser?.id) {
      return json({ error: "USER_NOT_FOUND" }, 404);
    }

    const planMeta = getPlanMeta(event.max_photos ?? null);

    const { data: createdEvent, error: eventError } = await supabaseAdmin
      .from("events")
      .insert({
        name: event.name,
        password_hash: event.password_hash,
        admin_password: event.admin_password,
        upload_start_time: event.upload_start_time,
        upload_end_time: event.upload_end_time,
        reveal_time: event.reveal_time,
        max_photos: event.max_photos ?? null,
        custom_image_url: event.custom_image_url ?? null,
        background_image_url: event.background_image_url ?? null,
        filter_type: event.filter_type ?? "none",
        font_family: event.font_family ?? "system",
        font_size: event.font_size ?? "text-3xl",
        is_demo: planMeta.type === "demo",
        type: planMeta.type,
        plan_id: planMeta.planId,
        limits_json: event.max_photos ? { max_photos: event.max_photos } : null,
        country_code: event.country_code ?? "ES",
        timezone: event.timezone ?? "Europe/Madrid",
        language: event.language ?? "es",
        description: event.description ?? null,
        expiry_date: event.expiry_date ?? null,
        expiry_redirect_url: event.expiry_redirect_url ?? null,
        allow_photo_deletion: event.allow_photo_deletion ?? true,
        allow_photo_sharing: event.allow_photo_sharing ?? true,
        show_legal_text: event.show_legal_text ?? false,
        legal_text_type: event.show_legal_text ? (event.legal_text_type ?? "default") : "default",
        custom_terms_text: event.custom_terms_text ?? null,
        custom_privacy_text: event.custom_privacy_text ?? null,
        gallery_view_mode: event.gallery_view_mode ?? "normal",
        like_counting_enabled: event.like_counting_enabled ?? false,
        owner_id: existingUser.id,
      })
      .select()
      .single();

    if (eventError || !createdEvent) {
      return json({ error: "CREATE_EVENT_FAILED", detail: eventError?.message ?? "unknown_error" }, 500);
    }

    // Send email to owner using existing template
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-demo-event-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          event: createdEvent,
          contactInfo: { email: ownerEmail },
          eventType: planMeta.type === "demo" ? "demo" : "paid",
          planLabel: planMeta.label,
          lang: createdEvent.language || "es",
        }),
      });
    } catch (emailError) {
      console.error("admin-create-event email error:", emailError);
    }

    return json({
      event: {
        ...createdEvent,
        owner_email: ownerEmail,
      },
    });
  } catch (error) {
    console.error("admin-create-event error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
