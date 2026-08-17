import type { Json } from "@/integrations/supabase/types";

export const TIME_CAPSULE_PLAN_ID = "capsule";
export const TIME_CAPSULE_MAX_VIDEO_SECONDS = 60;
export const TIME_CAPSULE_DEFAULT_DESCRIPTION =
  "Graba un vídeo especial y emotivo para los novios. Nadie podrá verlo: quedará guardado y sellado hasta que se abra la cápsula.";
export const TIME_CAPSULE_DEFAULT_LOGO_URL = "/LogoMiniRevelao.svg";
export const TIME_CAPSULE_DEFAULT_LOGO_LINK = "https://www.revelao.cam";
export const TIME_CAPSULE_YEAR_OPTIONS = [2, 3, 4, 5, 10] as const;
export const TIME_CAPSULE_REDEEM_PLANS = [
  { id: "capsule_basic", label: "Basic · hasta 50 mensajes", maxMessages: 50 },
  { id: "capsule_pro", label: "Pro · hasta 200 mensajes", maxMessages: 200 },
  { id: "capsule_unlimited", label: "Sin límites · mensajes ilimitados", maxMessages: null },
] as const;

export type TimeCapsuleRedeemPlanId = (typeof TIME_CAPSULE_REDEEM_PLANS)[number]["id"];

export type TimeCapsuleYears = (typeof TIME_CAPSULE_YEAR_OPTIONS)[number];
export type TimeCapsuleLogoMode = "default" | "custom" | "none";

export interface TimeCapsuleSettings {
  years: number;
  coupleNames: string | null;
  logoMode: TimeCapsuleLogoMode;
  logoUrl: string | null;
  logoLink: string | null;
}

const asRecord = (raw: Json | null | undefined): Record<string, Json | undefined> | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, Json | undefined>;
};

export const isTimeCapsuleEvent = (event: { plan_id?: string | null; type?: string | null } | null | undefined) =>
  !!event && (event.plan_id === TIME_CAPSULE_PLAN_ID || event.type === TIME_CAPSULE_PLAN_ID);

export const getTimeCapsuleSettings = (raw: Json | null | undefined): TimeCapsuleSettings => {
  const record = asRecord(raw);
  const capsule = record ? asRecord(record.capsule) : null;
  const years = capsule && typeof capsule.years === "number" ? capsule.years : 5;
  const coupleNames =
    capsule && typeof capsule.couple_names === "string" && capsule.couple_names.trim()
      ? capsule.couple_names.trim()
      : null;
  const rawLogoMode = capsule && typeof capsule.logo_mode === "string" ? capsule.logo_mode : "default";
  const logoMode: TimeCapsuleLogoMode = ["default", "custom", "none"].includes(rawLogoMode)
    ? rawLogoMode as TimeCapsuleLogoMode
    : "default";
  const logoUrl = capsule && typeof capsule.logo_url === "string" && capsule.logo_url.trim()
    ? capsule.logo_url.trim()
    : null;
  const logoLink = capsule && capsule.logo_link === null
    ? null
    : capsule && typeof capsule.logo_link === "string"
      ? normalizeTimeCapsuleLogoLink(capsule.logo_link)
      : TIME_CAPSULE_DEFAULT_LOGO_LINK;
  return { years, coupleNames, logoMode, logoUrl, logoLink };
};

export const withTimeCapsuleSettings = (
  raw: Json | null | undefined,
  settings: {
    years: number;
    coupleNames?: string | null;
    logoMode?: TimeCapsuleLogoMode;
    logoUrl?: string | null;
    logoLink?: string | null;
  },
): Json => {
  const record = asRecord(raw) || {};
  const currentCapsule = asRecord(record.capsule) || {};
  return {
    ...record,
    capsule: {
      ...currentCapsule,
      years: settings.years,
      couple_names: settings.coupleNames?.trim() || null,
      logo_mode: settings.logoMode || "default",
      logo_url: settings.logoUrl?.trim() || null,
      logo_link: settings.logoLink?.trim() || null,
    },
  } as Json;
};

export function normalizeTimeCapsuleLogoLink(value: string | null | undefined) {
  const clean = value?.trim();
  if (!clean) return null;
  const candidate = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** Public guest URL for the wedding time capsule QR. */
export const getTimeCapsulePublicUrl = (eventId: string) =>
  `https://acceso.revelao.cam/capsula/${eventId}`;

/** Adds whole years to a date, keeping day/time. */
export const addYears = (date: Date, years: number) => {
  const next = new Date(date.getTime());
  next.setFullYear(next.getFullYear() + years);
  return next;
};

export const formatCapsuleYearsLabel = (years: number) =>
  years === 1 ? "1 año" : `${years} años`;
