export type PlanId =
  | "demo"
  | "small"
  | "medium"
  | "large"
  | "xxl"
  | "capsule_basic"
  | "capsule_pro"
  | "capsule_unlimited";

export type PlanConfig = {
  id: PlanId;
  label: string;
  maxPhotos: number | null;
  maxVideos: number | null;
  maxAudios: number | null;
  stripePriceIdEnv: string;
  product?: "revelao" | "capsule";
};

export const PLANS: Record<PlanId, PlanConfig> = {
  demo: {
    id: "demo",
    label: "Demo",
    maxPhotos: 10,
    maxVideos: 3,
    maxAudios: 6,
    stripePriceIdEnv: "STRIPE_PRICE_DEMO",
  },
  small: {
    id: "small",
    label: "Start",
    maxPhotos: 200,
    maxVideos: 30,
    maxAudios: 60,
    stripePriceIdEnv: "STRIPE_PRICE_SMALL",
  },
  medium: {
    id: "medium",
    label: "Plus",
    maxPhotos: 5000,
    maxVideos: 200,
    maxAudios: 500,
    stripePriceIdEnv: "STRIPE_PRICE_MEDIUM",
  },
  large: {
    id: "large",
    label: "Plus",
    maxPhotos: 5000,
    maxVideos: 200,
    maxAudios: 500,
    stripePriceIdEnv: "STRIPE_PRICE_LARGE",
  },
  xxl: {
    id: "xxl",
    label: "Pro",
    maxPhotos: null,
    maxVideos: null,
    maxAudios: null,
    stripePriceIdEnv: "STRIPE_PRICE_XXL",
  },
  capsule_basic: {
    id: "capsule_basic",
    label: "Cápsula Basic · 50 mensajes",
    maxPhotos: 0,
    maxVideos: 50,
    maxAudios: 0,
    stripePriceIdEnv: "STRIPE_PRICE_CAPSULE_BASIC",
    product: "capsule",
  },
  capsule_pro: {
    id: "capsule_pro",
    label: "Cápsula Pro · 200 mensajes",
    maxPhotos: 0,
    maxVideos: 200,
    maxAudios: 0,
    stripePriceIdEnv: "STRIPE_PRICE_CAPSULE_PRO",
    product: "capsule",
  },
  capsule_unlimited: {
    id: "capsule_unlimited",
    label: "Cápsula Sin límites",
    maxPhotos: 0,
    maxVideos: null,
    maxAudios: 0,
    stripePriceIdEnv: "STRIPE_PRICE_CAPSULE_UNLIMITED",
    product: "capsule",
  },
};

export const getPlanById = (planId: string | null | undefined): PlanConfig | null => {
  if (!planId) return null;
  if (planId === "xl") return PLANS.xxl;
  return (PLANS as Record<string, PlanConfig>)[planId] ?? null;
};

export const getPlanByPriceId = (priceId: string | null | undefined, livemode = true): PlanConfig | null => {
  if (!priceId) return null;
  const suffix = livemode ? "" : "_TEST";
  return (
    Object.values(PLANS).find(
      (plan) => Deno.env.get(`${plan.stripePriceIdEnv}${suffix}`) === priceId,
    ) ?? null
  );
};
