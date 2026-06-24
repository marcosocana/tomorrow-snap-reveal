import { Json } from "@/integrations/supabase/types";

const QR_PASSWORD_ENABLED_KEY = "qr_password_enabled";
const QR_PASSWORD_HASH_KEY = "qr_password_hash";

const asRecord = (value: Json | null | undefined): Record<string, Json> => {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return { ...value } as Record<string, Json>;
};

export const getEventQrPasswordSettings = (limitsJson: Json | null | undefined) => {
  const limits = asRecord(limitsJson);
  const enabled = limits[QR_PASSWORD_ENABLED_KEY] === true;
  const hash = typeof limits[QR_PASSWORD_HASH_KEY] === "string" ? limits[QR_PASSWORD_HASH_KEY] : "";
  return { enabled, hash };
};

export const withEventQrPasswordSettings = (
  limitsJson: Json | null | undefined,
  enabled: boolean,
  hash: string | null
) => {
  const limits = asRecord(limitsJson);

  if (!enabled) {
    delete limits[QR_PASSWORD_ENABLED_KEY];
    delete limits[QR_PASSWORD_HASH_KEY];
    return Object.keys(limits).length ? limits : null;
  }

  limits[QR_PASSWORD_ENABLED_KEY] = true;
  limits[QR_PASSWORD_HASH_KEY] = hash || "";
  return limits;
};
