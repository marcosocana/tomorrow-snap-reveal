import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";
const BUCKET = "carreteo";
const SIGNED_URL_TTL = 60 * 60;
const MAX_IMAGE_BYTES = 8_388_608;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
});

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type JsonBody = Record<string, unknown>;
type CarreteoConfig = {
  event_id: string;
  slug: string;
  enabled: boolean;
  shots_per_camera: number;
  max_cameras: number | null;
};
type RevelaoEvent = {
  id: string;
  name: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  reveal_time: string | null;
  timezone: string | null;
  type: string | null;
  owner_id: string | null;
  background_image_url: string | null;
  event_number: number | null;
};
type Camera = {
  id: string;
  event_id: string;
  participant_id: string;
  access_token_hash: string;
  shots_taken: number;
};
type Photo = {
  id: string;
  camera_id: string;
  frame_number: number;
  image_path: string | null;
  thumbnail_path: string | null;
  is_visible: boolean;
  created_at: string;
  deleted_at: string | null;
};

const readString = (body: JsonBody, key: string) => typeof body[key] === "string" ? body[key] as string : "";
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const loadEvent = async (slug: string) => {
  const { data: configData, error: configError } = await admin.from("carreteo_event_configs")
    .select("event_id,slug,enabled,shots_per_camera,max_cameras")
    .eq("slug", slug).maybeSingle();
  if (configError) throw new Error("EVENT_LOOKUP_FAILED");
  if (!configData) return null;
  const config = configData as CarreteoConfig;
  const { data: eventData, error: eventError } = await admin.from("events")
    .select("id,name,upload_start_time,upload_end_time,reveal_time,timezone,type,owner_id,background_image_url,event_number")
    .eq("id", config.event_id).maybeSingle();
  if (eventError) throw new Error("EVENT_LOOKUP_FAILED");
  if (!eventData || eventData.type !== "carreteo") return null;
  return { config, event: eventData as RevelaoEvent };
};

const isRevealed = (event: RevelaoEvent) =>
  Boolean(event.reveal_time && Date.now() >= new Date(event.reveal_time).getTime());

const eventAvailability = (event: RevelaoEvent, config: CarreteoConfig) => {
  if (isRevealed(event)) return "revealed" as const;
  if (!config.enabled) return "inactive" as const;
  const now = Date.now();
  const start = event.upload_start_time ? new Date(event.upload_start_time).getTime() : null;
  const end = event.upload_end_time ? new Date(event.upload_end_time).getTime() : null;
  if (start && now < start) return "upcoming" as const;
  if (end && now > end) return "closed" as const;
  return "active" as const;
};

const findCamera = async (eventId: string, participantId: string, token: string) => {
  if (!isUuid(participantId) || token.length < 32) return null;
  const { data, error } = await admin.from("carreteo_cameras").select("*")
    .eq("event_id", eventId).eq("participant_id", participantId).maybeSingle();
  if (error) throw new Error("CAMERA_LOOKUP_FAILED");
  if (!data) return null;
  const camera = data as Camera;
  return timingSafeEqual(await hashToken(token), camera.access_token_hash) ? camera : null;
};

const signedUrl = async (path: string | null) => {
  if (!path) return null;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) throw new Error("SIGNED_URL_FAILED");
  return data.signedUrl;
};

const signedUrls = async (paths: string[]) => {
  if (!paths.length) return new Map<string, string>();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  if (error) throw new Error("SIGNED_URL_FAILED");
  return new Map((data ?? []).filter((item) => item.path && item.signedUrl).map((item) => [item.path as string, item.signedUrl]));
};

const publicEventPayload = (event: RevelaoEvent, config: CarreteoConfig) => ({
  name: event.name,
  slug: config.slug,
  startsAt: event.upload_start_time,
  endsAt: event.upload_end_time,
  revealAt: event.reveal_time,
  timezone: event.timezone || "Europe/Madrid",
  availability: eventAvailability(event, config),
  shotsPerCamera: config.shots_per_camera,
  coverImageUrl: event.background_image_url,
  eventNumber: event.event_number,
});

const getUser = async (req: Request) => {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token === SUPABASE_ANON_KEY) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
};

const canManage = async (req: Request, event: RevelaoEvent) => {
  const user = await getUser(req);
  if (!user) return false;
  return user.id === event.owner_id || (user.email || "").toLowerCase() === ADMIN_EMAIL;
};

const photoPage = async (eventId: string, body: JsonBody, maxLimit: number, onlyVisible: boolean) => {
  const page = Math.max(0, Math.floor(Number(body.page) || 0));
  const limit = Math.max(1, Math.min(maxLimit, Math.floor(Number(body.limit) || 30)));
  const from = page * limit;
  let query = admin.from("carreteo_photos")
    .select("id,camera_id,frame_number,image_path,thumbnail_path,is_visible,created_at,deleted_at")
    .eq("event_id", eventId);
  if (onlyVisible) query = query.eq("is_visible", true).is("deleted_at", null);
  const { data, error } = await query
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw new Error("GALLERY_LOAD_FAILED");
  const photos = (data ?? []) as Photo[];
  const paths = photos.flatMap((photo) => [photo.image_path, photo.thumbnail_path]).filter((path): path is string => Boolean(path));
  const urls = await signedUrls(Array.from(new Set(paths)));
  return { photos, urls, hasMore: photos.length === limit };
};

const handleJson = async (req: Request, body: JsonBody) => {
  const action = readString(body, "action");
  const slug = readString(body, "slug").trim().toLowerCase();
  if (!slug) return json({ error: "INVALID_EVENT" }, 400);
  const loaded = await loadEvent(slug);
  if (!loaded) return json({ error: "EVENT_NOT_FOUND" }, 404);
  const { config, event } = loaded;

  if (action === "event") {
    const camera = await findCamera(event.id, readString(body, "participantId"), readString(body, "participantToken"));
    return json({ event: publicEventPayload(event, config), shotsTaken: camera?.shots_taken ?? 0 });
  }

  if (action === "gallery") {
    if (!isRevealed(event)) return json({ error: "NOT_REVEALED_YET", event: publicEventPayload(event, config) }, 403);
    const { photos, urls, hasMore } = await photoPage(event.id, body, 60, true);
    if (Math.floor(Number(body.page) || 0) === 0) {
      await admin.rpc("increment_carreteo_gallery_views", { target_event_id: event.id });
    }
    const { count } = await admin.from("carreteo_photos").select("id", { count: "exact", head: true })
      .eq("event_id", event.id).eq("is_visible", true).is("deleted_at", null);
    return json({
      event: publicEventPayload(event, config),
      total: count ?? photos.length,
      photos: photos.map((photo) => ({
        id: photo.id,
        imageUrl: urls.get(photo.image_path ?? "") ?? null,
        thumbnailUrl: urls.get(photo.thumbnail_path ?? "") ?? urls.get(photo.image_path ?? "") ?? null,
        takenAt: photo.created_at,
      })).filter((photo) => photo.imageUrl),
      hasMore,
    });
  }

  if (action === "admin-list") {
    if (!(await canManage(req, event))) return json({ error: "FORBIDDEN" }, 403);
    const { photos, urls, hasMore } = await photoPage(event.id, body, 60, false);
    const cameraIds = Array.from(new Set(photos.map((photo) => photo.camera_id)));
    const { data: cameras } = cameraIds.length
      ? await admin.from("carreteo_cameras").select("id,participant_id").in("id", cameraIds)
      : { data: [] };
    const cameraLabels = new Map((cameras ?? []).map((camera) => [camera.id, `Cámara ${String(camera.participant_id).slice(0, 4).toUpperCase()}`]));
    const { data: metrics, error: metricsError } = await admin.rpc("get_carreteo_admin_metrics", { target_event_id: event.id });
    if (metricsError) throw new Error("ADMIN_METRICS_LOAD_FAILED");
    const { data: views } = await admin.from("carreteo_event_configs").select("gallery_views").eq("event_id", event.id).maybeSingle();
    return json({
      event: publicEventPayload(event, config),
      metrics: { ...(metrics as Record<string, unknown>), galleryViews: views?.gallery_views ?? 0 },
      photos: photos.map((photo) => ({
        id: photo.id,
        cameraLabel: cameraLabels.get(photo.camera_id) ?? "Cámara",
        frameNumber: photo.frame_number,
        isVisible: photo.is_visible,
        removed: Boolean(photo.deleted_at),
        takenAt: photo.created_at,
        imageUrl: photo.deleted_at ? null : urls.get(photo.image_path ?? "") ?? null,
        thumbnailUrl: photo.deleted_at ? null : urls.get(photo.thumbnail_path ?? "") ?? urls.get(photo.image_path ?? "") ?? null,
      })),
      hasMore,
    });
  }

  if (action === "admin-visibility" || action === "admin-delete") {
    if (!(await canManage(req, event))) return json({ error: "FORBIDDEN" }, 403);
    const photoId = readString(body, "photoId");
    if (!isUuid(photoId)) return json({ error: "INVALID_PHOTO" }, 400);
    const { data, error } = await admin.from("carreteo_photos").select("*")
      .eq("id", photoId).eq("event_id", event.id).maybeSingle();
    if (error || !data) return json({ error: "PHOTO_NOT_FOUND" }, 404);
    if (action === "admin-visibility") {
      await admin.from("carreteo_photos").update({ is_visible: body.isVisible === true }).eq("id", photoId);
      return json({ ok: true });
    }
    const photo = data as Photo;
    const paths = [photo.image_path, photo.thumbnail_path].filter((path): path is string => Boolean(path));
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    await admin.from("carreteo_photos").update({
      is_visible: false,
      image_path: null,
      thumbnail_path: null,
      deleted_at: new Date().toISOString(),
    }).eq("id", photoId);
    return json({ ok: true });
  }

  return json({ error: "INVALID_ACTION" }, 400);
};

const handleShot = async (form: FormData) => {
  const slug = String(form.get("slug") || "").trim().toLowerCase();
  const participantId = String(form.get("participantId") || "");
  const participantToken = String(form.get("participantToken") || "");
  if (!isUuid(participantId) || participantToken.length < 32) return json({ error: "INVALID_PARTICIPANT" }, 400);

  const loaded = await loadEvent(slug);
  if (!loaded) return json({ error: "EVENT_NOT_FOUND" }, 404);
  const { event, config } = loaded;
  if (eventAvailability(event, config) !== "active") return json({ error: "EVENT_NOT_ACTIVE" }, 409);

  const image = form.get("image");
  const thumbnail = form.get("thumbnail");
  if (!(image instanceof File) || !(thumbnail instanceof File)) return json({ error: "FILES_REQUIRED" }, 400);
  if ([image, thumbnail].some((file) => file.size <= 0 || file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/webp"].includes(file.type))) {
    return json({ error: "INVALID_FILE" }, 400);
  }

  const { error: claimError } = await admin.rpc("claim_carreteo_camera", {
    target_event_id: event.id,
    target_participant_id: participantId,
    target_access_token_hash: await hashToken(participantToken),
  });
  if (claimError?.message.includes("CARRETEO_CAMERA_LIMIT_REACHED")) return json({ error: "CAMERA_LIMIT_REACHED" }, 409);
  if (claimError) throw new Error("CAMERA_CLAIM_FAILED");
  const camera = await findCamera(event.id, participantId, participantToken);
  if (!camera) return json({ error: "INVALID_PARTICIPANT" }, 403);
  if (camera.shots_taken >= config.shots_per_camera) return json({ error: "ROLL_FINISHED", shotsTaken: camera.shots_taken }, 409);

  const shotId = crypto.randomUUID();
  const extension = (file: File) => file.type === "image/webp" ? "webp" : "jpg";
  const imagePath = `${event.id}/${camera.id}/${shotId}.${extension(image)}`;
  const thumbnailPath = `${event.id}/${camera.id}/${shotId}-thumb.${extension(thumbnail)}`;
  try {
    for (const [path, file] of [[imagePath, image], [thumbnailPath, thumbnail]] as const) {
      const { error } = await admin.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error("UPLOAD_FAILED");
    }
    const { data, error } = await admin.rpc("record_carreteo_shot", {
      target_camera_id: camera.id,
      target_event_id: event.id,
      target_image_path: imagePath,
      target_thumbnail_path: thumbnailPath,
    });
    if (error?.message.includes("CARRETEO_ROLL_FINISHED")) {
      await admin.storage.from(BUCKET).remove([imagePath, thumbnailPath]);
      return json({ error: "ROLL_FINISHED", shotsTaken: config.shots_per_camera }, 409);
    }
    if (error || !data) throw new Error("RECORD_FAILED");
    return json({ shotsTaken: (data as Photo).frame_number });
  } catch (error) {
    await admin.storage.from(BUCKET).remove([imagePath, thumbnailPath]);
    console.error("carreteo shot failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "SAVE_FAILED" }, 500);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SERVER_CONFIGURATION" }, 500);
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) return await handleShot(await req.formData());
    const body = await req.json() as JsonBody;
    return await handleJson(req, body);
  } catch (error) {
    console.error("carreteo-api error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
