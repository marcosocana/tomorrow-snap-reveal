import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { useAdminI18n } from "@/lib/adminI18n";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const plans = [
  {
    titleKey: "pricing.plan.demo",
    subtitleKey: "pricing.plan.demo.subtitle",
    ctaKey: "pricing.plan.demo.cta",
    planId: "demo",
    price: "0€",
  },
  {
    titleKey: "pricing.plan.small",
    subtitleKey: "pricing.plan.small.subtitle",
    planId: "small",
    price: "39€",
  },
  {
    titleKey: "pricing.plan.medium",
    subtitleKey: "pricing.plan.medium.subtitle",
    planId: "medium",
    price: "79€",
    featured: true,
  },
  {
    titleKey: "pricing.plan.xl",
    subtitleKey: "pricing.plan.xl.subtitle",
    planId: "xxl",
    price: "149€",
  },
];

type PricingPreviewProps = {
  showHeader?: boolean;
  onSelectPlan?: (planId: string) => void;
  mobileLayout?: "carousel" | "stack";
  hideDemo?: boolean;
};

export const PricingPreview = ({
  showHeader = true,
  onSelectPlan,
  mobileLayout = "carousel",
  hideDemo = false,
}: PricingPreviewProps) => {
  const { t, pathPrefix } = useAdminI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const visiblePlans = hideDemo ? plans.filter((plan) => plan.planId !== "demo") : plans;
  const planFeatures: Record<string, string[]> = {
    demo: [
      t("pricing.plan.demo.feature.photos"),
      t("pricing.plan.demo.feature.gallery"),
      t("pricing.plan.demo.feature.download"),
      t("pricing.plan.demo.feature.brand"),
      t("pricing.plan.demo.feature.qr"),
      t("pricing.plan.demo.feature.panel"),
    ],
    small: [
      t("pricing.plan.small.feature.photos"),
      t("pricing.plan.small.feature.gallery"),
      t("pricing.plan.small.feature.download"),
      t("pricing.plan.small.feature.brand"),
      t("pricing.plan.small.feature.access"),
      t("pricing.plan.small.feature.qr"),
      t("pricing.plan.small.feature.panel"),
      t("pricing.plan.small.feature.ideal"),
    ],
    medium: [
      t("pricing.plan.medium.feature.photos"),
      t("pricing.plan.medium.feature.gallery"),
      t("pricing.plan.medium.feature.download"),
      t("pricing.plan.medium.feature.brand"),
      t("pricing.plan.medium.feature.access"),
      t("pricing.plan.medium.feature.support"),
      t("pricing.plan.medium.feature.qr"),
      t("pricing.plan.medium.feature.panel"),
      t("pricing.plan.medium.feature.ideal"),
    ],
    xxl: [
      t("pricing.plan.xl.feature.photos"),
      t("pricing.plan.xl.feature.gallery"),
      t("pricing.plan.xl.feature.brand"),
      t("pricing.plan.xl.feature.download"),
      t("pricing.plan.xl.feature.support"),
      t("pricing.plan.xl.feature.backup"),
      t("pricing.plan.xl.feature.qr"),
      t("pricing.plan.xl.feature.panel"),
      t("pricing.plan.xl.feature.ideal"),
    ],
  };

  const handleCheckout = async (planId: string) => {
    if (onSelectPlan) {
      onSelectPlan(planId);
      return;
    }

    if (planId === "demo") {
      navigate(`${pathPrefix}/nuevoeventodemo`);
      return;
    }

    const testUrlMap: Record<string, string | undefined> = {
      small: import.meta.env.VITE_STRIPE_CHECKOUT_URL_SMALL ?? "https://buy.stripe.com/dRmdR2fCVbTMgIv0nl3ks06",
      medium: import.meta.env.VITE_STRIPE_CHECKOUT_URL_MEDIUM ?? "https://buy.stripe.com/00w9AM3UdaPIfEr4DB3ks05",
      large: import.meta.env.VITE_STRIPE_CHECKOUT_URL_LARGE,
      xxl: import.meta.env.VITE_STRIPE_CHECKOUT_URL_XXL ?? "https://buy.stripe.com/7sY3co8at3ngfErc633ks04",
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

  const renderPlanCard = (plan: (typeof plans)[number]) => (
    <div
      key={plan.planId}
      className={[
        "relative rounded-3xl border bg-card p-6 shadow-sm h-full w-full max-w-[360px]",
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
        <p className="text-sm text-muted-foreground">{t(plan.subtitleKey)}</p>
        <div className="flex items-end gap-2 pt-1">
          <span className="text-4xl font-bold text-foreground">{plan.price}</span>
          <span className="text-sm text-muted-foreground pb-1">{t("pricing.perEvent")}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-6">
        {(planFeatures[plan.planId] ?? []).map((feature) => {
          const normalized = feature.toLowerCase();
          const isIdeal =
            normalized.startsWith("ideal para") ||
            normalized.startsWith("ideal for") ||
            normalized.startsWith("ideale per");
          const Icon = isIdeal ? Star : Check;
          const iconClass = isIdeal ? "text-foreground" : "text-[#f06a5f]";
          return (
            <li key={feature} className="flex items-start gap-3">
              <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconClass}`} />
              <span className="text-sm text-foreground">{feature}</span>
            </li>
          );
        })}
      </ul>

      <Button
        className={[
          "w-full",
          plan.featured
            ? "bg-[#f06a5f] text-white hover:bg-[#e95f54]"
            : plan.planId === "small" || plan.planId === "xxl"
            ? "bg-black text-white hover:bg-black/90"
            : "border-[#e5e7eb] text-foreground hover:bg-[#f9fafb]",
        ].join(" ")}
        variant={plan.featured || plan.planId === "small" || plan.planId === "xxl" ? "default" : "outline"}
        onClick={() => handleCheckout(plan.planId)}
      >
        {plan.ctaKey ? t(plan.ctaKey) : t("pricing.cta")}
      </Button>
    </div>
  );

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

      {mobileLayout === "carousel" ? (
        <div className="md:hidden">
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent className="ml-0">
              {visiblePlans.map((plan) => (
                <CarouselItem key={plan.planId} className="basis-[85%] sm:basis-1/2 pl-0 pr-4">
                  {renderPlanCard(plan)}
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:inline-flex" />
            <CarouselNext className="hidden sm:inline-flex" />
          </Carousel>
        </div>
      ) : (
        <div className="md:hidden space-y-4">
          {visiblePlans.map((plan) => renderPlanCard(plan))}
        </div>
      )}

      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6 justify-items-center">
        {visiblePlans.map((plan) => renderPlanCard(plan))}
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
