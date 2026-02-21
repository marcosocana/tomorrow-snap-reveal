import { Button } from "@/components/ui/button";
import { PricingPreview } from "@/components/PricingPreview";
import { useNavigate } from "react-router-dom";
import { useAdminI18n } from "@/lib/adminI18n";

const PricingPlans = () => {
  const navigate = useNavigate();
  const { t, pathPrefix } = useAdminI18n();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {t("plans.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("plans.subtitle")}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(`${pathPrefix}/event-management`)}>
            {t("plans.back")}
          </Button>
        </div>

        <PricingPreview />
      </div>
    </div>
  );
};

export default PricingPlans;
