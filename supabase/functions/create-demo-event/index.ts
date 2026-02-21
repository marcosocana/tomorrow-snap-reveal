import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

type DemoEventPayload = {
  contactEmail: string;
  password: string;
  phone?: string | null;
  event: {
    name: string;
    password_hash: string;
    admin_password: string;
    upload_start_time: string;
    upload_end_time: string;
    reveal_time: string;
    max_photos: number;
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
    return json({ error: "Missing Supabase env" }, 500);
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  );

  try {
    const payload = (await req.json()) as DemoEventPayload;
    const email = payload?.contactEmail?.trim().toLowerCase() ?? "";
    const password = payload?.password ?? "";
    const phone = payload?.phone?.trim() || null;
    const event = payload?.event;

    if (!email || !isEmail(email)) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }
    if (!password || password.length < 8) {
      return json({ error: "INVALID_PASSWORD" }, 400);
    }
    if (!event?.name || !event.password_hash || !event.admin_password) {
      return json({ error: "INVALID_EVENT" }, 400);
    }

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({
      email,
    });
    if (existingUsers?.users?.length) {
      return json({ error: "USER_EXISTS" }, 409);
    }

    const { data: newUser, error: createUserError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createUserError || !newUser?.user) {
      return json({ error: "CREATE_USER_FAILED" }, 500);
    }

    const userId = newUser.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: userId,
        phone,
      });

    if (profileError) {
      return json({ error: "CREATE_PROFILE_FAILED" }, 500);
    }

    const { data: createdEvent, error: eventError } = await supabaseAdmin
      .from("events")
      .insert({
        name: event.name,
        password_hash: event.password_hash,
        admin_password: event.admin_password,
        upload_start_time: event.upload_start_time,
        upload_end_time: event.upload_end_time,
        reveal_time: event.reveal_time,
        max_photos: event.max_photos ?? 10,
        custom_image_url: event.custom_image_url ?? null,
        background_image_url: event.background_image_url ?? null,
        filter_type: event.filter_type ?? "none",
        font_family: event.font_family ?? "system",
        font_size: event.font_size ?? "text-3xl",
        is_demo: true,
        type: "demo",
        plan_id: "demo",
        limits_json: { max_photos: event.max_photos ?? 10 },
        country_code: event.country_code ?? "ES",
        timezone: event.timezone ?? "Europe/Madrid",
        language: event.language ?? "es",
        description: event.description ?? null,
        expiry_date: null,
        expiry_redirect_url: null,
        allow_photo_deletion: true,
        show_legal_text: true,
        owner_id: userId,
      })
      .select()
      .single();

    if (eventError || !createdEvent) {
      return json({ error: "CREATE_EVENT_FAILED" }, 500);
    }

    return json({
      userId,
      event: createdEvent,
    });
  } catch (error) {
    console.error("create-demo-event error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
