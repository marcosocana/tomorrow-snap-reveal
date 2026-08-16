import type { Json } from "@/integrations/supabase/types";

export const TIME_CAPSULE_PLAN_ID = "capsule";
export const TIME_CAPSULE_MAX_VIDEO_SECONDS = 60;
export const TIME_CAPSULE_DEFAULT_DESCRIPTION =
  "Graba un vídeo de hasta 60 segundos para los novios. Nadie podrá verlo: quedará guardado y sellado hasta que abran la cápsula, cuando volverán a vivir este día.";
export const TIME_CAPSULE_YEAR_OPTIONS = [2, 3, 4, 5, 10] as const;

export type TimeCapsuleYears = (typeof TIME_CAPSULE_YEAR_OPTIONS)[number];

export interface TimeCapsuleSettings {
  years: number;
  coupleNames: string | null;
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
  return { years, coupleNames };
};

export const withTimeCapsuleSettings = (
  raw: Json | null | undefined,
  settings: { years: number; coupleNames?: string | null },
): Json => {
  const record = asRecord(raw) || {};
  return {
    ...record,
    capsule: {
      years: settings.years,
      couple_names: settings.coupleNames?.trim() || null,
    },
  } as Json;
};

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
