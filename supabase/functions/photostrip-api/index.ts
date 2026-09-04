import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";
const BUCKET = "photostrips";
const SIGNED_URL_TTL = 60 * 60;

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
type PhotostripConfig = {
  event_id: string;
  slug: string;
  enabled: boolean;
  photo_count: number;
  countdown_seconds: number;
  photo_mode: "color" | "bw" | "both";
  gallery_visibility: "public" | "participants" | "admin_only";
  strip_template: "classic";
  strip_display_name: string | null;
  strip_footer_text: string | null;
  logo_path: string | null;
  logo_url: string | null;
  max_strips: number | null;
};
type RevelaoEvent = {
  id: string;
  name: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  timezone: string | null;
  type: string | null;
  owner_id: string | null;
  background_image_url: string | null;
};
type Participation = {
  id: string;
  event_id: string;
  participant_id: string;
  access_token_hash: string;
  mode: "color" | "bw";
  status: "started" | "capturing" | "processing" | "completed" | "failed";
  strip_path: string | null;
  thumbnail_path: string | null;
  is_visible: boolean;
  download_count: number;
  created_at: string;
  completed_at: string | null;
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
  const { data: configData, error: configError } = await admin.from("photostrip_event_configs")
    .select("event_id,slug,enabled,photo_count,countdown_seconds,photo_mode,gallery_visibility,strip_template,strip_display_name,strip_footer_text,logo_path,logo_url,max_strips")
    .eq("slug", slug).maybeSingle();
  if (configError) throw new Error("EVENT_LOOKUP_FAILED");
  if (!configData) return null;
  const config = configData as PhotostripConfig;
  const { data: eventData, error: eventError } = await admin.from("events")
    .select("id,name,upload_start_time,upload_end_time,timezone,type,owner_id,background_image_url")
    .eq("id", config.event_id).maybeSingle();
  if (eventError) throw new Error("EVENT_LOOKUP_FAILED");
  if (!eventData || eventData.type !== "photostrip") return null;
  return { config, event: eventData as RevelaoEvent };
};

const eventAvailability = (event: RevelaoEvent, config: PhotostripConfig) => {
  if (!config.enabled) return "inactive" as const;
  const now = Date.now();
  const start = event.upload_start_time ? new Date(event.upload_start_time).getTime() : null;
  const end = event.upload_end_time ? new Date(event.upload_end_time).getTime() : null;
  if (start && now < start) return "upcoming" as const;
  if (end && now > end) return "ended" as const;
  return "active" as const;
};

const verifyParticipant = async (eventId: string, participantId: string, token: string) => {
  if (!isUuid(participantId) || token.length < 32) return null;
  const { data, error } = await admin.from("photostrip_participations").select("*")
    .eq("event_id", eventId).eq("participant_id", participantId).maybeSingle();
  if (error) throw new Error("PARTICIPATION_LOOKUP_FAILED");
  if (!data) return null;
  const participation = data as Participation;
  const candidateHash = await hashToken(token);
  return timingSafeEqual(candidateHash, participation.access_token_hash) ? participation : null;
};

const signedUrl = async (path: string | null) => {
  if (!path) return null;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) throw new Error("SIGNED_URL_FAILED");
  return data.signedUrl;
};

const publicEventPayload = async (event: RevelaoEvent, config: PhotostripConfig) => ({
  name: event.name,
  slug: config.slug,
  startsAt: event.upload_start_time,
  endsAt: event.upload_end_time,
  timezone: event.timezone || "Europe/Madrid",
  availability: eventAvailability(event, config),
  photoCount: config.photo_count,
  countdownSeconds: config.countdown_seconds,
  photoMode: config.photo_mode,
  galleryVisibility: config.gallery_visibility,
  galleryAllowed: config.gallery_visibility !== "admin_only",
  stripTemplate: config.strip_template,
  stripDisplayName: config.strip_display_name || event.name,
  stripFooterText: config.strip_footer_text,
  logoUrl: config.logo_path ? await signedUrl(config.logo_path) : config.logo_url,
  coverImageUrl: event.background_image_url,
  maxStrips: config.max_strips,
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

const handleJson = async (req: Request, body: JsonBody) => {
  const action = readString(body, "action");
  const slug = readString(body, "slug").trim().toLowerCase();
  if (!slug) return json({ error: "INVALID_EVENT" }, 400);
  const loaded = await loadEvent(slug);
  if (!loaded) return json({ error: "EVENT_NOT_FOUND" }, 404);
  const { config, event } = loaded;

  if (action === "event") {
    return json({ event: await publicEventPayload(event, config) });
  }

  if (action === "participation") {
    const participation = await verifyParticipant(
      event.id,
      readString(body, "participantId"),
      readString(body, "participantToken"),
    );
    if (!participation) return json({ participation: null });
    return json({
      participation: {
        status: participation.status,
        mode: participation.mode,
        completedAt: participation.completed_at,
        removed: Boolean(participation.deleted_at),
        stripUrl: participation.deleted_at ? null : await signedUrl(participation.strip_path),
      },
    });
  }

  if (action === "start") {
    const participantId = readString(body, "participantId");
    const participantToken = readString(body, "participantToken");
    const requestedMode = readString(body, "mode");
    if (!isUuid(participantId) || participantToken.length < 32 || !["color", "bw"].includes(requestedMode)) {
      return json({ error: "INVALID_PARTICIPANT" }, 400);
    }
    if (eventAvailability(event, config) !== "active") return json({ error: "EVENT_NOT_ACTIVE" }, 409);
    if (config.photo_mode !== "both" && requestedMode !== config.photo_mode) {
      return json({ error: "MODE_NOT_ALLOWED" }, 400);
    }
    const tokenHash = await hashToken(participantToken);
    const { error: claimError } = await admin.rpc("claim_photostrip_participation", {
      target_event_id: event.id,
      target_participant_id: participantId,
      target_access_token_hash: tokenHash,
      target_mode: requestedMode,
    });
    if (claimError?.message.includes("PHOTOSTRIP_LIMIT_REACHED")) {
      return json({ error: "PHOTOSTRIP_LIMIT_REACHED" }, 409);
    }
    if (claimError) throw new Error("PARTICIPATION_CREATE_FAILED");
    const participation = await verifyParticipant(event.id, participantId, participantToken);
    if (!participation) return json({ error: "PARTICIPATION_ALREADY_CLAIMED" }, 409);
    if (participation.status === "completed") {
      return json({ status: "completed", stripUrl: await signedUrl(participation.strip_path) });
    }
    await admin.from("photostrip_participations").update({ status: "capturing" }).eq("id", participation.id);
    return json({ status: "capturing" });
  }

  if (action === "gallery") {
    if (config.gallery_visibility === "admin_only") return json({ error: "GALLERY_PRIVATE" }, 403);
    const page = Math.max(0, Math.floor(Number(body.page) || 0));
    const limit = Math.max(1, Math.min(24, Math.floor(Number(body.limit) || 24)));
    const from = page * limit;
    const { data, error } = await admin.from("photostrip_participations")
      .select("id,thumbnail_path,strip_path,completed_at", { count: "exact" })
      .eq("event_id", event.id).eq("status", "completed").eq("is_visible", true)
      .is("deleted_at", null).order("completed_at", { ascending: false }).range(from, from + limit - 1);
    if (error) throw new Error("GALLERY_LOAD_FAILED");
    const strips = await Promise.all((data ?? []).map(async (item) => ({
      key: item.id,
      thumbnailUrl: await signedUrl(item.thumbnail_path || item.strip_path),
      stripUrl: await signedUrl(item.strip_path),
      completedAt: item.completed_at,
    })));
    if (page === 0) await admin.rpc("increment_photostrip_gallery_views", { target_event_id: event.id });
    return json({ event: await publicEventPayload(event, config), strips, hasMore: strips.length === limit });
  }

  if (action === "download" || action === "gallery-download") {
    let participation: Participation | null = null;
    if (action === "download") {
      participation = await verifyParticipant(event.id, readString(body, "participantId"), readString(body, "participantToken"));
    } else if (config.gallery_visibility !== "admin_only") {
      const participationId = readString(body, "participationId");
      if (isUuid(participationId)) {
        const { data } = await admin.from("photostrip_participations").select("*")
          .eq("id", participationId).eq("event_id", event.id).eq("status", "completed")
          .eq("is_visible", true).is("deleted_at", null).maybeSingle();
        participation = data as Participation | null;
      }
    }
    if (!participation || participation.deleted_at || !participation.strip_path) {
      return json({ error: "PHOTOSTRIP_NOT_FOUND" }, 404);
    }
    await admin.from("photostrip_participations").update({ download_count: participation.download_count + 1 }).eq("id", participation.id);
    return json({ stripUrl: await signedUrl(participation.strip_path) });
  }

  if (action === "admin-list") {
    if (!(await canManage(req, event))) return json({ error: "FORBIDDEN" }, 403);
    const page = Math.max(0, Math.floor(Number(body.page) || 0));
    const limit = Math.max(1, Math.min(60, Math.floor(Number(body.limit) || 24)));
    const from = page * limit;
    const { data, error } = await admin.from("photostrip_participations")
      .select("id,participant_id,status,mode,strip_path,thumbnail_path,is_visible,download_count,created_at,completed_at,deleted_at")
      .eq("event_id", event.id).order("created_at", { ascending: false }).range(from, from + limit - 1);
    if (error) throw new Error("ADMIN_GALLERY_LOAD_FAILED");
    const items = await Promise.all((data ?? []).map(async (item, index) => ({
      id: item.id,
      guestLabel: `Guest ${String(item.participant_id).slice(0, 4).toUpperCase()}`,
      status: item.status,
      mode: item.mode,
      isVisible: item.is_visible,
      downloads: item.download_count,
      createdAt: item.created_at,
      completedAt: item.completed_at,
      removed: Boolean(item.deleted_at),
      thumbnailUrl: item.deleted_at ? null : await signedUrl(item.thumbnail_path || item.strip_path),
      stripUrl: item.deleted_at ? null : await signedUrl(item.strip_path),
      order: index,
    })));
    const { data: metrics, error: metricsError } = await admin.rpc("get_photostrip_admin_metrics", { target_event_id: event.id });
    if (metricsError) throw new Error("ADMIN_METRICS_LOAD_FAILED");
    return json({ event: await publicEventPayload(event, config), participations: items, metrics, hasMore: items.length === limit });
  }

  if (action === "admin-visibility" || action === "admin-delete") {
    if (!(await canManage(req, event))) return json({ error: "FORBIDDEN" }, 403);
    const participationId = readString(body, "participationId");
    if (!isUuid(participationId)) return json({ error: "INVALID_PARTICIPATION" }, 400);
    const { data, error } = await admin.from("photostrip_participations").select("*")
      .eq("id", participationId).eq("event_id", event.id).maybeSingle();
    if (error || !data) return json({ error: "PARTICIPATION_NOT_FOUND" }, 404);
    if (action === "admin-visibility") {
      await admin.from("photostrip_participations").update({ is_visible: body.isVisible === true }).eq("id", participationId);
      return json({ ok: true });
    }
    const participation = data as Participation;
    const { data: photos } = await admin.from("photostrip_photos").select("image_path").eq("participation_id", participationId);
    const paths = [participation.strip_path, participation.thumbnail_path, ...(photos ?? []).map((photo) => photo.image_path)]
      .filter((path): path is string => Boolean(path));
    if (paths.length) await admin.storage.from(BUCKET).remove(paths);
    await admin.from("photostrip_participations").update({
      is_visible: false,
      strip_path: null,
      thumbnail_path: null,
      deleted_at: new Date().toISOString(),
    }).eq("id", participationId);
    return json({ ok: true });
  }

  return json({ error: "INVALID_ACTION" }, 400);
};

const handleComplete = async (form: FormData) => {
  const slug = String(form.get("slug") || "").trim().toLowerCase();
  const participantId = String(form.get("participantId") || "");
  const participantToken = String(form.get("participantToken") || "");
  const loaded = await loadEvent(slug);
  if (!loaded) return json({ error: "EVENT_NOT_FOUND" }, 404);
  const { event, config } = loaded;
  const participation = await verifyParticipant(event.id, participantId, participantToken);
  if (!participation) return json({ error: "INVALID_PARTICIPANT" }, 403);
  if (participation.deleted_at) return json({ error: "PARTICIPATION_REMOVED" }, 410);
  if (participation.status === "completed") {
    return json({ status: "completed", stripUrl: await signedUrl(participation.strip_path) });
  }

  const photos = Array.from({ length: 4 }, (_, index) => form.get(`photo${index + 1}`));
  const strip = form.get("strip");
  const thumbnail = form.get("thumbnail");
  if (photos.some((file) => !(file instanceof File)) || !(strip instanceof File) || !(thumbnail instanceof File)) {
    return json({ error: "FILES_REQUIRED" }, 400);
  }
  const files = [...photos as File[], strip, thumbnail];
  if (files.some((file) => file.size <= 0 || file.size > 5_242_880 || !["image/webp", "image/jpeg", "image/png"].includes(file.type))) {
    return json({ error: "INVALID_FILE" }, 400);
  }

  await admin.from("photostrip_participations").update({ status: "processing" }).eq("id", participation.id);
  const prefix = `${event.id}/${participantId}`;
  const photoPaths = photos.map((_, index) => `${prefix}/photo-${String(index + 1).padStart(2, "0")}.webp`);
  const stripPath = `${prefix}/strip.webp`;
  const thumbnailPath = `${prefix}/thumbnail.webp`;
  const paths = [...photoPaths, stripPath, thumbnailPath];
  try {
    for (let index = 0; index < files.length; index += 1) {
      const { error } = await admin.storage.from(BUCKET).upload(paths[index], files[index], {
        contentType: files[index].type,
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw new Error("UPLOAD_FAILED");
    }
    const { data, error } = await admin.rpc("complete_photostrip_participation", {
      target_participation_id: participation.id,
      target_event_id: event.id,
      target_strip_path: stripPath,
      target_thumbnail_path: thumbnailPath,
      target_photo_paths: photoPaths,
    });
    if (error || !data) throw new Error("FINALIZE_FAILED");
    return json({ status: "completed", stripUrl: await signedUrl(stripPath) });
  } catch (error) {
    await admin.from("photostrip_participations").update({ status: "failed" }).eq("id", participation.id);
    console.error("photostrip completion failed:", error instanceof Error ? error.message : "unknown");
    return json({ error: "SAVE_FAILED" }, 500);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "SERVER_CONFIGURATION" }, 500);
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) return await handleComplete(await req.formData());
    const body = await req.json() as JsonBody;
    return await handleJson(req, body);
  } catch (error) {
    console.error("photostrip-api error:", error instanceof Error ? error.message : "unknown");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
