import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const DEMO_LOGO_URL = "https://acceso.revelao.cam/LogoMiniRevelao.svg";

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

const notifyAdminNewEvent = async (event: unknown) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/notify-admin-new-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ event }),
    });
    if (!response.ok) {
      console.error("notify-admin-new-event response error:", await response.text());
    }
  } catch (error) {
    console.error("notify-admin-new-event error:", error);
  }
};

type DemoEventPayload = {
  contactName?: string | null;
  contactEmail: string;
  password: string;
  phone?: string | null;
  marketingConsent?: boolean;
  useAuthenticatedUser?: boolean;
  event: {
    name: string;
    password_hash: string;
    admin_password: string;
    upload_start_time: string;
    upload_end_time: string;
    reveal_time: string;
    max_photos: number;
    allow_video_recording?: boolean;
    max_videos?: number | null;
    max_video_duration?: number | null;
    allow_audio_recording?: boolean;
    max_audios?: number | null;
    max_audio_duration?: number | null;
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

const isUserExistsError = (message: string) =>
  message.toLowerCase().includes("already been registered") ||
  message.toLowerCase().includes("user already registered") ||
  message.toLowerCase().includes("email already") ||
  message.toLowerCase().includes("already exists");

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) => {
  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = (data?.users || []).find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if ((data?.users || []).length < 1000) return null;
  }
  return null;
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

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });

  try {
    const payload = (await req.json()) as DemoEventPayload;
    const requestedEmail = payload?.contactEmail?.trim().toLowerCase() ?? "";
    const contactName = payload?.contactName?.trim() || null;
    const password = payload?.password ?? "";
    const phone = payload?.phone?.trim() || null;
    const marketingConsent = payload?.marketingConsent ?? true;
    const useAuthenticatedUser = payload?.useAuthenticatedUser === true;
    const event = payload?.event;
    const {
      data: { user: authenticatedUser },
    } = await supabaseClient.auth.getUser();
    const email = useAuthenticatedUser
      ? authenticatedUser?.email?.trim().toLowerCase() ?? ""
      : requestedEmail;

    if (!email || !isEmail(email)) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }
    if (useAuthenticatedUser && !authenticatedUser?.id) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }
    if (!useAuthenticatedUser && (!password || password.length < 8)) {
      return json({ error: "INVALID_PASSWORD" }, 400);
    }
    if (!event?.name || !event.password_hash || !event.admin_password) {
      return json({ error: "INVALID_EVENT" }, 400);
    }

    const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);

    // Never replace an existing account password with a generated demo
    // password. Existing users must manage their events with their own login.
    if (!useAuthenticatedUser && existingAuthUser?.id) {
      return json({ error: "EMAIL_EXISTS" }, 409);
    }

    let userId = useAuthenticatedUser ? authenticatedUser?.id ?? null : existingAuthUser?.id || null;

    if (!userId) {
      const { data: newUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createUserError || !newUser?.user) {
        const message = createUserError?.message ?? "unknown_error";
        console.error("create-demo-event createUserError:", message);
        if (isUserExistsError(message)) {
          const fallbackUser = await findAuthUserByEmail(supabaseAdmin, email);

          if (fallbackUser?.id) {
            userId = fallbackUser.id;
          } else {
            return json({ error: "USER_EXISTS", detail: message }, 409);
          }
        } else {
          return json({ error: "CREATE_USER_FAILED", detail: message }, 500);
        }
      }

      if (!userId) {
        userId = newUser!.user!.id;
      }
    }

    // Ensure only one demo event per user
    const { data: existingDemo } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("owner_id", userId)
      .eq("type", "demo")
      .maybeSingle();

    if (existingDemo?.id) {
      return json({ error: "DEMO_ALREADY_EXISTS" }, 409);
    }

    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        id: userId,
        phone,
        marketing_opt_in: marketingConsent,
      }, { onConflict: "id" });

    if (profileError) {
      return json({ error: "CREATE_PROFILE_FAILED", detail: profileError.message }, 500);
    }

    const revealBase = new Date(event.reveal_time);
    const expiryDate = new Date(revealBase);
    expiryDate.setUTCDate(expiryDate.getUTCDate() + 10);
    expiryDate.setUTCHours(23, 59, 0, 0);

    const resolvedCustomImageUrl = event.custom_image_url?.trim() || DEMO_LOGO_URL;

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
        custom_image_url: resolvedCustomImageUrl,
        background_image_url: event.background_image_url ?? null,
        filter_type: event.filter_type ?? "none",
        font_family: event.font_family ?? "system",
        font_size: event.font_size ?? "text-3xl",
        is_demo: true,
        type: "demo",
        plan_id: "demo",
        limits_json: {
          max_photos: event.max_photos ?? 10,
          max_videos: event.max_videos ?? 3,
          max_audios: event.max_audios ?? 6,
          created_from: "nuevoeventodemo2",
          admin_event_tab: "new",
          demo_contact: {
            name: contactName,
            email,
            phone,
          },
        },
        country_code: event.country_code ?? "ES",
        timezone: event.timezone ?? "Europe/Madrid",
        language: event.language ?? "es",
        description: event.description ?? null,
        expiry_date: expiryDate.toISOString(),
        expiry_redirect_url: null,
        allow_photo_deletion: true,
        allow_video_recording: event.allow_video_recording ?? true,
        max_videos: event.max_videos ?? 3,
        max_video_duration: event.max_video_duration ?? 15,
        allow_audio_recording: event.allow_audio_recording ?? true,
        max_audios: event.max_audios ?? 6,
        max_audio_duration: event.max_audio_duration ?? 30,
        show_legal_text: false,
        owner_id: userId,
      })
      .select()
      .single();

    if (eventError || !createdEvent) {
      const detail = eventError?.message ?? "unknown_error";
      console.error("create-demo-event createEventError:", detail);
      return json({ error: "CREATE_EVENT_FAILED", detail }, 500);
    }

    await notifyAdminNewEvent(createdEvent);

    return json({
      userId,
      event: createdEvent,
    });
  } catch (error) {
    console.error("create-demo-event error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
