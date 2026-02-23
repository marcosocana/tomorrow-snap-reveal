export type PlanId = "demo" | "small" | "medium" | "large" | "xxl";

export type PlanConfig = {
  id: PlanId;
  label: string;
  maxPhotos: number | null;
  stripePriceIdEnv: string;
};

export const PLANS: Record<PlanId, PlanConfig> = {
  demo: {
    id: "demo",
    label: "Demo",
    maxPhotos: 10,
    stripePriceIdEnv: "STRIPE_PRICE_DEMO",
  },
  small: {
    id: "small",
    label: "Start",
    maxPhotos: 200,
    stripePriceIdEnv: "STRIPE_PRICE_SMALL",
  },
  medium: {
    id: "medium",
    label: "Plus",
    maxPhotos: 1200,
    stripePriceIdEnv: "STRIPE_PRICE_MEDIUM",
  },
  large: {
    id: "large",
    label: "Plus",
    maxPhotos: 1200,
    stripePriceIdEnv: "STRIPE_PRICE_LARGE",
  },
  xxl: {
    id: "xxl",
    label: "Pro",
    maxPhotos: null,
    stripePriceIdEnv: "STRIPE_PRICE_XXL",
  },
};

export const getPlanById = (planId: string | null | undefined): PlanConfig | null => {
  if (!planId) return null;
  if (planId === "xl") return PLANS.xxl;
  return (PLANS as Record<string, PlanConfig>)[planId] ?? null;
};
