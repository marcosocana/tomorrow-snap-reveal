import { supabase } from "@/integrations/supabase/client";

export const getEventUrl = (eventPassword: string) =>
  `https://acceso.revelao.cam/events/${eventPassword}`;

export const getFallbackQrUrl = (eventUrl: string, size = 220) =>
  `https://quickchart.io/qr?size=${size}&margin=1&ecLevel=H&text=${encodeURIComponent(eventUrl)}`;

export const getQrImageUrlFromLimits = (raw: unknown) => {
  if (!raw) return null;
  let limits = raw;
  if (typeof raw === "string") {
    try {
      limits = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) return null;
  const qrImageUrl = (limits as Record<string, unknown>).qr_image_url;
  return typeof qrImageUrl === "string" && qrImageUrl.trim() ? qrImageUrl.trim() : null;
};

export const getStoredEventQrUrl = (eventId: string | null | undefined, limitsJson?: unknown) => {
  if (!eventId) return null;
  const limitsQrUrl = getQrImageUrlFromLimits(limitsJson);
  if (limitsQrUrl) return limitsQrUrl;
  return localStorage.getItem(`event-qr-url-${eventId}`);
};

export const getEventQrStorageUrl = (eventId: string | null | undefined) => {
  if (!eventId) return null;
  return supabase.storage.from("event-photos").getPublicUrl(`event-qr/qr-${eventId}.png`).data.publicUrl;
};

