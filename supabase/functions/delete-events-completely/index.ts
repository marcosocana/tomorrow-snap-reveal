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

const chunks = <T>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
};

const storagePathFromValue = (value: unknown, bucket: string) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value.trim();
  if (!/^https?:\/\//i.test(clean)) return clean.replace(/^\/+/, "");

  try {
    const pathname = decodeURIComponent(new URL(clean).pathname);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
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
    const body = await req.json().catch(() => ({}));
    const eventIds: string[] = Array.from(
      new Set<string>(
        (Array.isArray(body?.eventIds) ? body.eventIds : [])
          .filter((value: unknown): value is string => typeof value === "string" && value.length > 0),
      ),
    ).slice(0, 100);
    const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword.trim() : "";
    if (eventIds.length === 0) return json({ error: "EVENT_IDS_REQUIRED" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: events, error: eventsError } = await admin
      .from("events")
      .select("id,owner_id,admin_password,custom_image_url,background_image_url,limits_json")
      .in("id", eventIds);
    if (eventsError) return json({ error: "LOAD_EVENTS_FAILED", detail: eventsError.message }, 500);
    if (!events || events.length !== eventIds.length) return json({ error: "EVENT_NOT_FOUND" }, 404);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let user: { id: string; email?: string } | null = null;
    if (token) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { data } = await userClient.auth.getUser(token);
      user = data.user ? { id: data.user.id, email: data.user.email } : null;
    }

    const isSuperAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
    const ownsEveryEvent = Boolean(user && events.every((event) => event.owner_id === user?.id));
    const hasRestrictedAdminAccess =
      events.length === 1 && Boolean(adminPassword) && events[0].admin_password === adminPassword;
    if (!isSuperAdmin && !ownsEveryEvent && !hasRestrictedAdminAccess) {
      return json({ error: "FORBIDDEN" }, 403);
    }

    const [photosResult, videosResult, audiosResult] = await Promise.all([
      admin.from("photos").select("image_url").in("event_id", eventIds),
      admin.from("videos").select("video_url,thumbnail_url").in("event_id", eventIds),
      admin.from("audios").select("audio_url").in("event_id", eventIds),
    ]);
    const mediaError = photosResult.error || videosResult.error || audiosResult.error;
    if (mediaError) return json({ error: "LOAD_MEDIA_FAILED", detail: mediaError.message }, 500);

    const pathsByBucket: Record<string, Set<string>> = {
      "event-photos": new Set<string>(),
      "event-videos": new Set<string>(),
      "event-audios": new Set<string>(),
    };
    const addPath = (bucket: keyof typeof pathsByBucket, value: unknown) => {
      const path = storagePathFromValue(value, bucket);
      if (path) pathsByBucket[bucket].add(path);
    };

    (photosResult.data || []).forEach((row) => addPath("event-photos", row.image_url));
    (videosResult.data || []).forEach((row) => {
      addPath("event-videos", row.video_url);
      addPath("event-videos", row.thumbnail_url);
    });
    (audiosResult.data || []).forEach((row) => addPath("event-audios", row.audio_url));
    events.forEach((event) => {
      addPath("event-photos", event.custom_image_url);
      addPath("event-photos", event.background_image_url);
      pathsByBucket["event-photos"].add(`event-qr/qr-${event.id}.png`);
    });

    // Include orphan files that were uploaded successfully but whose database
    // insert failed. All captured media is stored under an event-id prefix.
    for (const bucket of Object.keys(pathsByBucket)) {
      for (const eventId of eventIds) {
        let offset = 0;
        while (true) {
          const { data: objects, error: listError } = await admin.storage
            .from(bucket)
            .list(eventId, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
          if (listError) return json({ error: "LIST_STORAGE_FAILED", detail: listError.message }, 500);
          (objects || []).forEach((object) => {
            if (object.id) pathsByBucket[bucket].add(`${eventId}/${object.name}`);
          });
          if (!objects || objects.length < 1000) break;
          offset += objects.length;
        }
      }
    }

    let deletedObjects = 0;
    for (const [bucket, pathSet] of Object.entries(pathsByBucket)) {
      for (const batch of chunks(Array.from(pathSet), 100)) {
        if (batch.length === 0) continue;
        const { error } = await admin.storage.from(bucket).remove(batch);
        if (error) return json({ error: "DELETE_STORAGE_FAILED", detail: error.message, bucket }, 500);
        deletedObjects += batch.length;
      }
    }

    const { error: deleteError } = await admin.from("events").delete().in("id", eventIds);
    if (deleteError) return json({ error: "DELETE_EVENTS_FAILED", detail: deleteError.message }, 500);

    return json({ deleted_events: eventIds.length, deleted_objects: deletedObjects });
  } catch (error) {
    console.error("delete-events-completely error:", error);
    return json({ error: "UNKNOWN_ERROR", detail: error instanceof Error ? error.message : String(error) }, 500);
  }
});
