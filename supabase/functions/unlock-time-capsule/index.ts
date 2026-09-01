import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPERADMIN_EMAIL = "revelao.cam@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) return json({ error: "SERVER_CONFIG" }, 500);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

  const body = await req.json().catch(() => ({})) as { eventId?: string; password?: string };
  if (!body.eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: event, error: eventError } = await admin.from("events")
    .select("id,owner_id,upload_end_time,plan_id,type")
    .eq("id", body.eventId).maybeSingle();
  if (eventError || !event) return json({ error: "EVENT_NOT_FOUND" }, 404);
  if (event.plan_id !== "capsule" && event.type !== "capsule") return json({ error: "NOT_A_CAPSULE" }, 400);

  const isSuperAdmin = user.email?.trim().toLowerCase() === SUPERADMIN_EMAIL;
  if (!isSuperAdmin && user.id !== event.owner_id) return json({ error: "FORBIDDEN" }, 403);
  const { data: credential, error: credentialError } = await admin.from("time_capsule_unlock_credentials")
    .select("password_hash,unlock_password").eq("event_id", event.id).maybeSingle();
  if (credentialError || !credential) return json({ error: "CREDENTIAL_UNAVAILABLE" }, 500);
  if (!isSuperAdmin) {
    const password = body.password?.trim().toUpperCase() ?? "";
    if (!password) return json({ error: "PASSWORD_REQUIRED" }, 400);
    if (await sha256(password) !== credential.password_hash) {
      return json({ error: "INVALID_PASSWORD" }, 403);
    }
  }

  const { data: videos, error: videosError } = await admin.from("videos")
    .select("id,video_url,thumbnail_url,duration_seconds,captured_at,metadata")
    .eq("event_id", event.id).order("captured_at", { ascending: true });
  if (videosError) return json({ error: "VIDEOS_UNAVAILABLE" }, 500);

  const videoPaths = Array.from(new Set((videos ?? []).flatMap((video) => [
    video.video_url,
    ...(video.thumbnail_url ? [video.thumbnail_url] : []),
  ])));
  const { data: signedRows, error: signedError } = videoPaths.length > 0
    ? await admin.storage.from("event-videos").createSignedUrls(videoPaths, 3600)
    : { data: [], error: null };
  if (signedError) return json({ error: "VIDEOS_UNAVAILABLE" }, 500);
  const signedUrls = new Map((signedRows ?? []).map((row) => [row.path, row.signedUrl]));

  const signedVideos = (videos ?? []).map((video) => {
    const metadata = video.metadata && typeof video.metadata === "object" && !Array.isArray(video.metadata)
      ? video.metadata as Record<string, unknown>
      : {};
    return {
      id: video.id,
      url: signedUrls.get(video.video_url) ?? null,
      thumbnailUrl: video.thumbnail_url ? signedUrls.get(video.thumbnail_url) ?? null : null,
      durationSeconds: video.duration_seconds,
      capturedAt: video.captured_at,
      guestName: typeof metadata.guest_name === "string" ? metadata.guest_name : null,
    };
  });

  return json({
    unlocked: true,
    isSuperAdmin,
    unlockPassword: isSuperAdmin ? credential.unlock_password : undefined,
    videos: signedVideos.filter((video) => video.url),
  });
});
