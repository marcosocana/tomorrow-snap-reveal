import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAdminI18n } from "@/lib/adminI18n";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    titleKey: "pricing.plan.small",
    planId: "small",
    guests: 50,
    price: "36€",
    costPerGuest: "0,72€",
  },
  {
    titleKey: "pricing.plan.medium",
    planId: "medium",
    guests: 300,
    price: "74€",
    costPerGuest: "0,25€",
    featured: true,
  },
  {
    titleKey: "pricing.plan.large",
    planId: "large",
    guests: 500,
    price: "96€",
    costPerGuest: "0,19€",
  },
  {
    titleKey: "pricing.plan.xl",
    planId: "xl",
    guests: 1000,
    price: "139€",
    costPerGuest: "0,14€",
  },
];

type PricingPreviewProps = {
  showHeader?: boolean;
  onSelectPlan?: (planId: string) => void;
};

export const PricingPreview = ({ showHeader = true, onSelectPlan }: PricingPreviewProps) => {
  const { t, pathPrefix } = useAdminI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const baseFeatures = [
    t("pricing.feature.photos"),
    t("pricing.feature.gallery"),
    t("pricing.feature.download"),
    t("pricing.feature.brand"),
    t("pricing.feature.support"),
  ];

  const handleCheckout = async (planId: string) => {
    if (onSelectPlan) {
      onSelectPlan(planId);
      return;
    }

    const testUrlMap: Record<string, string | undefined> = {
      small: import.meta.env.VITE_STRIPE_CHECKOUT_URL_SMALL,
      medium: import.meta.env.VITE_STRIPE_CHECKOUT_URL_MEDIUM,
      large: import.meta.env.VITE_STRIPE_CHECKOUT_URL_LARGE,
      xl: import.meta.env.VITE_STRIPE_CHECKOUT_URL_XL,
    };
    const testUrl = testUrlMap[planId];
    if (testUrl) {
      window.location.href = testUrl;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate(`${pathPrefix}/admin-login`);
      return;
    }

    const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", {
      body: { planId },
    });

    if (error || !data?.url) {
      toast({
        title: t("form.errorTitle"),
        description: t("pricing.errorCheckout") ?? "No se pudo iniciar el pago",
        variant: "destructive",
      });
      return;
    }

    window.location.href = data.url;
  };

  return (
    <div className="space-y-10">
      {showHeader && (
        <div className="text-center space-y-2">
          <h3 className="text-3xl md:text-4xl font-semibold text-foreground">
            {t("pricing.title")}
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.planId}
            className={[
              "relative rounded-3xl border bg-card p-6 shadow-sm transition-all duration-300",
              "hover:-translate-y-1",
              plan.featured
                ? "border-[#f06a5f]/40 bg-[#f06a5f]/5 shadow-[0_20px_40px_-30px_rgba(240,106,95,0.35)]"
                : "border-border",
            ].join(" ")}
          >
            {plan.featured ? (
              <span className="absolute right-5 top-5 rounded-full bg-[#f06a5f] text-white text-xs font-semibold px-3 py-1 shadow-sm">
                {t("pricing.badge")}
              </span>
            ) : null}

            <div className="mb-6 space-y-2">
              <h4 className="text-lg font-semibold text-foreground">{t(plan.titleKey)}</h4>
              <p className="text-sm text-muted-foreground">{t("pricing.guests", { count: plan.guests })}</p>
              <div className="flex items-end gap-2 pt-1">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground pb-1">{t("pricing.perEvent")}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("pricing.perGuest", { amount: plan.costPerGuest })}
              </p>
            </div>

            <ul className="space-y-3 mb-6">
              {baseFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#f06a5f]" />
                  <span className="text-sm text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              className={[
                "w-full",
                plan.featured
                  ? "bg-[#f06a5f] text-white hover:bg-[#e95f54]"
                  : "border-[#e5e7eb] text-foreground hover:bg-[#f9fafb]",
              ].join(" ")}
              variant={plan.featured ? "default" : "outline"}
              onClick={() => handleCheckout(plan.planId)}
            >
              {t("pricing.cta")}
            </Button>
          </div>
        ))}
      </div>

      {showHeader && (
        <p className="text-center text-sm text-muted-foreground">
          {t("pricing.moreGuests")}{" "}
          <a
            className="text-foreground font-semibold hover:underline"
            href={`https://wa.me/34695834018?text=${encodeURIComponent(t("pricing.whatsappMessage"))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("pricing.contact")}
          </a>
          .
        </p>
      )}
    </div>
  );
};
