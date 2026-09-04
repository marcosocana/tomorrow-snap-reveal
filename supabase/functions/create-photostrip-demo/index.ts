import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

type Payload = {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  password?: string;
  eventName?: string;
  stripFooterText?: string;
  photoMode?: "color" | "bw" | "both";
  coverImageUrl?: string | null;
  timezone?: string;
};

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const slugify = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42);
const isUserExistsError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("already been registered") || normalized.includes("already exists") || normalized.includes("email already");
};

const findUserByEmail = async (admin: ReturnType<typeof createClient>, email: string) => {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = (data.users || []).find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user || null;
  }
  return null;
};

const notifyAdmin = async (event: unknown) => {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-admin-new-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ event }),
    });
  } catch (error) {
    console.error("create-photostrip-demo notify error:", error instanceof Error ? error.message : "unknown");
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SERVER_CONFIGURATION" }, 500);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let createdEventId: string | null = null;
  try {
    const payload = await req.json() as Payload;
    const email = payload.contactEmail?.trim().toLowerCase() || "";
    const password = payload.password || "";
    const contactName = payload.contactName?.trim().slice(0, 120) || "";
    const contactPhone = payload.contactPhone?.trim().slice(0, 40) || "";
    const eventName = payload.eventName?.trim().slice(0, 200) || "";
    const footer = payload.stripFooterText?.trim().slice(0, 120) || null;
    const photoMode = ["color", "bw", "both"].includes(payload.photoMode || "") ? payload.photoMode! : "both";
    const timezone = payload.timezone?.trim().slice(0, 80) || "Europe/Madrid";
    let coverImageUrl: string | null = null;
    if (payload.coverImageUrl) {
      const parsed = new URL(payload.coverImageUrl);
      if (!["http:", "https:"].includes(parsed.protocol) || payload.coverImageUrl.length > 2048) return json({ error: "INVALID_COVER" }, 400);
      coverImageUrl = parsed.toString();
    }

    if (!eventName) return json({ error: "INVALID_EVENT" }, 400);
    if (!contactName || !contactPhone || !isEmail(email)) return json({ error: "INVALID_CONTACT" }, 400);
    if (password.length < 8) return json({ error: "INVALID_PASSWORD" }, 400);

    const existingUser = await findUserByEmail(admin, email);
    let userId = existingUser?.id || null;
    let createdNewUser = false;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) {
        if (!isUserExistsError(error?.message || "")) return json({ error: "CREATE_USER_FAILED" }, 500);
        userId = (await findUserByEmail(admin, email))?.id || null;
      } else {
        userId = data.user.id;
        createdNewUser = true;
      }
    }
    if (!createdNewUser) {
      const credentialClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await credentialClient.auth.signInWithPassword({ email, password });
      if (error || data.user?.id !== userId) return json({ error: "INVALID_CREDENTIALS" }, 401);
    }
    if (!userId) return json({ error: "CREATE_USER_FAILED" }, 500);

    const { error: profileError } = await admin.from("user_profiles").upsert({ id: userId, phone: contactPhone, marketing_opt_in: true }, { onConflict: "id" });
    if (profileError) return json({ error: "CREATE_PROFILE_FAILED" }, 500);

    const now = new Date();
    const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiry = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
    const { data: event, error: eventError } = await admin.from("events").insert({
      name: eventName,
      password_hash: `photostrip-${crypto.randomUUID()}`,
      admin_password: password,
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
      plan_id: "photostrip-demo",
      is_demo: true,
      owner_id: userId,
      expiry_date: expiry.toISOString(),
      show_legal_text: false,
      limits_json: {
        max_photostrips: 3,
        created_from: "nuevophotostripdemo",
        demo_contact: { name: contactName, email, phone: contactPhone },
      },
    }).select("id,name,upload_start_time,upload_end_time,timezone,is_demo,type,plan_id").single();
    if (eventError || !event) return json({ error: "CREATE_EVENT_FAILED", detail: eventError?.message }, 500);
    createdEventId = event.id;

    const slugBase = slugify(eventName) || "photostrip";
    const slug = `${slugBase}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const { error: configError } = await admin.from("photostrip_event_configs").insert({
      event_id: event.id,
      slug,
      enabled: true,
      photo_count: 4,
      countdown_seconds: 3,
      photo_mode: photoMode,
      gallery_visibility: "public",
      strip_template: "classic",
      strip_display_name: eventName,
      strip_footer_text: footer,
      logo_url: DEFAULT_LOGO_URL,
      max_strips: 3,
    });
    if (configError) {
      await admin.from("events").delete().eq("id", event.id);
      createdEventId = null;
      return json({ error: "CREATE_CONFIG_FAILED", detail: configError.message }, 500);
    }

    await notifyAdmin(event);
    return json({ event, slug, eventUrl: `https://acceso.revelao.cam/photostrip/${slug}`, maxStrips: 3 });
  } catch (error) {
    if (createdEventId) await admin.from("events").delete().eq("id", createdEventId);
    console.error("create-photostrip-demo error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
