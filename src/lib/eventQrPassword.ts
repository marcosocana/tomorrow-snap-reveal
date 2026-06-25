import { Json } from "@/integrations/supabase/types";

const QR_PASSWORD_ENABLED_KEY = "qr_password_enabled";
const QR_PASSWORD_HASH_KEY = "qr_password_hash";
const QR_PASSWORD_SCOPE_KEY = "qr_password_scope";

export type QrPasswordScope = {
  camera: boolean;
  gallery: boolean;
};

const asRecord = (value: Json | null | undefined): Record<string, Json> => {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return { ...value } as Record<string, Json>;
};

export const getEventQrPasswordSettings = (limitsJson: Json | null | undefined) => {
  const limits = asRecord(limitsJson);
  const enabled = limits[QR_PASSWORD_ENABLED_KEY] === true;
  const hash = typeof limits[QR_PASSWORD_HASH_KEY] === "string" ? limits[QR_PASSWORD_HASH_KEY] : "";
  const rawScope = limits[QR_PASSWORD_SCOPE_KEY];
  const parsedScope =
    rawScope && typeof rawScope === "object" && !Array.isArray(rawScope)
      ? (rawScope as Record<string, Json>)
      : null;
  const scope = {
    camera: parsedScope ? parsedScope.camera === true : enabled,
    gallery: parsedScope ? parsedScope.gallery === true : enabled,
  };
  return { enabled, hash, scope };
};

export const withEventQrPasswordSettings = (
  limitsJson: Json | null | undefined,
  enabled: boolean,
  hash: string | null,
  scope: QrPasswordScope = { camera: true, gallery: true }
) => {
  const limits = asRecord(limitsJson);

  if (!enabled) {
    delete limits[QR_PASSWORD_ENABLED_KEY];
    delete limits[QR_PASSWORD_HASH_KEY];
    delete limits[QR_PASSWORD_SCOPE_KEY];
    return Object.keys(limits).length ? limits : null;
  }

  limits[QR_PASSWORD_ENABLED_KEY] = true;
  limits[QR_PASSWORD_HASH_KEY] = hash || "";
  limits[QR_PASSWORD_SCOPE_KEY] = {
    camera: scope.camera,
    gallery: scope.gallery,
  };
  return limits;
};

export const shouldRequestQrPassword = (
  limitsJson: Json | null | undefined,
  target: keyof QrPasswordScope
) => {
  const settings = getEventQrPasswordSettings(limitsJson);
  return settings.enabled && !!settings.hash && settings.scope[target];
};
