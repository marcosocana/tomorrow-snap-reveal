import { Button } from "@/components/ui/button";
import { PricingPreview } from "@/components/PricingPreview";
import { useNavigate } from "react-router-dom";

const PricingPlans = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Planes disponibles
            </h1>
            <p className="text-sm text-muted-foreground">
              Elige el plan ideal para tu evento y continúa desde tu demo.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/event-management")}>
            Volver a gestión
          </Button>
        </div>

        <PricingPreview />
      </div>
    </div>
  );
};

export default PricingPlans;
