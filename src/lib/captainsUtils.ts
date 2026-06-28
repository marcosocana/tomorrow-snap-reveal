export const CAPTAINS_PUBLIC_PATH = "/capitanes";

export const slugifyCaptainsValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "capitanes";

export const getCaptainsPublicUrl = (slug: string, origin = window.location.origin) =>
  `${origin}${CAPTAINS_PUBLIC_PATH}/${slug}`;

export const getCaptainsQrValue = (slug: string, origin = window.location.origin) =>
  getCaptainsPublicUrl(slug, origin);

export const calculateCaptainsAutomaticScore = ({
  maxPoints,
  hasTimeLimit,
  totalSeconds,
  remainingSeconds,
  succeeded = true,
}: {
  maxPoints: number;
  hasTimeLimit: boolean;
  totalSeconds?: number | null;
  remainingSeconds?: number | null;
  succeeded?: boolean;
}) => {
  if (!succeeded) return 0;
  if (!hasTimeLimit) return maxPoints;
  if (!totalSeconds || totalSeconds <= 0) return maxPoints;
  if (!remainingSeconds || remainingSeconds <= 0) return 0;

  return Math.max(1, Math.ceil(maxPoints * (remainingSeconds / totalSeconds)));
};

export const shuffleCaptainsItems = <T>(items: T[]) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
};

export const sanitizeCaptainsFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "evidencia";
