import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const storagePathFromValue = (value: string) => {
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const markers = [
      "/storage/v1/object/public/event-photos/",
      "/storage/v1/object/sign/event-photos/",
      "/storage/v1/object/event-photos/",
    ];
    const marker = markers.find((candidate) => pathname.includes(candidate));
    return marker ? pathname.slice(pathname.indexOf(marker) + marker.length) : null;
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "MISSING_SUPABASE_ENV" }, 500);
  }

  try {
    const { eventId, photoId } = (await req.json()) as { eventId?: string; photoId?: string };
    if (!eventId || !photoId) return json({ error: "INVALID_INPUT" }, 400);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "UNAUTHORIZED" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const [{ data: event, error: eventError }, { data: photo, error: photoError }] = await Promise.all([
      admin.from("events").select("id,owner_id").eq("id", eventId).maybeSingle(),
      admin.from("photos").select("id,event_id,image_url").eq("id", photoId).maybeSingle(),
    ]);
    if (eventError || photoError) return json({ error: "LOAD_FAILED" }, 500);
    if (!event || !photo || photo.event_id !== event.id) return json({ error: "NOT_FOUND" }, 404);

    const isOwner = event.owner_id === authData.user.id;
    const isSuperAdmin = authData.user.email?.toLowerCase() === ADMIN_EMAIL;
    if (!isOwner && !isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);

    const storagePath = storagePathFromValue(photo.image_url);
    if (storagePath) {
      const { error: storageError } = await admin.storage.from("event-photos").remove([storagePath]);
      if (storageError) return json({ error: "STORAGE_DELETE_FAILED" }, 500);
    }

    const { error: deleteError } = await admin.from("photos").delete().eq("id", photo.id);
    if (deleteError) return json({ error: "PHOTO_DELETE_FAILED" }, 500);
    return json({ ok: true });
  } catch (error) {
    console.error("slideshow-delete-photo error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
