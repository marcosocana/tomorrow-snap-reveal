export type PlanId = "small" | "medium" | "large" | "xl";

export type PlanConfig = {
  id: PlanId;
  label: string;
  maxPhotos: number | null;
  stripePriceIdEnv: string;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  small: {
    id: "small",
    label: "Pequeño",
    maxPhotos: 50,
    stripePriceIdEnv: "STRIPE_PRICE_SMALL",
  },
  medium: {
    id: "medium",
    label: "Mediano",
    maxPhotos: 300,
    stripePriceIdEnv: "STRIPE_PRICE_MEDIUM",
  },
  large: {
    id: "large",
    label: "Grande",
    maxPhotos: 500,
    stripePriceIdEnv: "STRIPE_PRICE_LARGE",
  },
  xl: {
    id: "xl",
    label: "XL",
    maxPhotos: 1000,
    stripePriceIdEnv: "STRIPE_PRICE_XL",
  },
};

export const getPlanById = (planId: string | null | undefined): PlanConfig | null => {
  if (!planId) return null;
  return (PLANS as Record<string, PlanConfig>)[planId] ?? null;
};
