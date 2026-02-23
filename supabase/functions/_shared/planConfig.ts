export type PlanId = "small" | "medium" | "large" | "xxl";

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
  xxl: {
    id: "xxl",
    label: "XXL",
    maxPhotos: 1000,
    stripePriceIdEnv: "STRIPE_PRICE_XXL",
  },
};

export const getPlanById = (planId: string | null | undefined): PlanConfig | null => {
  if (!planId) return null;
  if (planId === "xl") return PLANS.xxl;
  return (PLANS as Record<string, PlanConfig>)[planId] ?? null;
};
