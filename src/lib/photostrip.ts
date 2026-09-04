import { supabase } from "@/integrations/supabase/client";

export type PhotostripMode = "color" | "bw";
export type PhotostripPhotoMode = PhotostripMode | "both";
export type PhotostripGalleryVisibility = "public" | "participants" | "admin_only";
export type PhotostripAvailability = "active" | "upcoming" | "ended" | "inactive";

export type PublicPhotostripEvent = {
  name: string;
  slug: string;
  startsAt: string | null;
  endsAt: string | null;
  timezone: string;
  availability: PhotostripAvailability;
  photoCount: number;
  countdownSeconds: number;
  photoMode: PhotostripPhotoMode;
  galleryVisibility: PhotostripGalleryVisibility;
  galleryAllowed: boolean;
  stripTemplate: "classic";
  stripDisplayName: string;
  stripFooterText: string | null;
  logoUrl: string | null;
};

export type PhotostripParticipationResult = {
  status: "started" | "capturing" | "processing" | "completed" | "failed";
  mode: PhotostripMode;
  completedAt: string | null;
  removed: boolean;
  stripUrl: string | null;
};

export type PhotostripGalleryItem = {
  key: string;
  thumbnailUrl: string;
  stripUrl: string;
  completedAt: string;
};

type ApiErrorPayload = { error?: string };

const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/photostrip-api`;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const photostripApi = async <T>(body: Record<string, unknown> | FormData, authenticated = false): Promise<T> => {
  const headers: Record<string, string> = { apikey: apiKey };
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("UNAUTHORIZED");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: "INVALID_RESPONSE" })) as T & ApiErrorPayload;
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload;
};

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const getPhotostripIdentity = (slug: string) => {
  const key = `revelao-photostrip-participant:${slug}`;
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "null") as { id?: string; token?: string } | null;
    if (existing?.id && existing.token) return { id: existing.id, token: existing.token };
  } catch {
    // Replace malformed local state with a fresh anonymous identity.
  }
  const identity = {
    id: crypto.randomUUID(),
    token: bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  localStorage.setItem(key, JSON.stringify(identity));
  return identity;
};

export const downloadPhotostrip = async (url: string, slug: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `revelao-photostrip-${slug}.webp`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
};
