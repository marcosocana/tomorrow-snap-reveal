import { Button } from "@/components/ui/button";
import { PricingPreview } from "@/components/PricingPreview";
import { useNavigate } from "react-router-dom";
import { useAdminI18n } from "@/lib/adminI18n";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

const PricingPlans = () => {
  const navigate = useNavigate();
  const { t, pathPrefix } = useAdminI18n();
  const { toast } = useToast();
  const [captainsTableCount, setCaptainsTableCount] = useState(6);
  const [captainsPack, setCaptainsPack] = useState(false);
  const [isCaptainsCheckoutLoading, setIsCaptainsCheckoutLoading] = useState(false);
  const captainsTotal = useMemo(
    () => captainsTableCount * (3 + (captainsPack ? 12.95 : 0)),
    [captainsPack, captainsTableCount],
  );

  const formatEur = (amount: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(amount);

  const handleCaptainsCheckout = async () => {
    const tableCount = Math.max(1, Math.min(999, Math.floor(captainsTableCount || 1)));
    setCaptainsTableCount(tableCount);
    try {
      setIsCaptainsCheckoutLoading(true);
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", {
        body: {
          planId: "captains",
          tableCount,
          captainPack: captainsPack,
        },
      });

      if (error || !data?.url) {
        toast({
          title: "No se pudo abrir Stripe",
          description: "Revisa la configuración de precios de Capitanes e inténtalo de nuevo.",
          variant: "destructive",
        });
        return;
      }

      window.location.href = data.url;
    } finally {
      setIsCaptainsCheckoutLoading(false);
    }
  };

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
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold uppercase text-[#f06a5f]">Capitanes</p>
                <h2 className="text-2xl font-bold text-foreground">Juego de Capitanes por mesa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pago único calculado por número de mesas. Puedes añadir el pack Capitán como extra por mesa.
                </p>
              </div>
              <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f06a5f]" /> 3,00 € por mesa</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f06a5f]" /> Onboarding público de creación</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f06a5f]" /> QR y enlace al juego</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f06a5f]" /> Pack Capitán opcional +12,95 €/mesa</li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Número de mesas</span>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={captainsTableCount}
                  onChange={(event) => setCaptainsTableCount(Math.max(1, Math.min(999, Number(event.target.value) || 1)))}
                  className="h-11"
                />
              </label>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  checked={captainsPack}
                  onChange={(event) => setCaptainsPack(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#f06a5f]"
                />
                <span>
                  <span className="block font-medium text-foreground">Añadir pack Capitán</span>
                  <span className="block text-muted-foreground">+12,95 € por mesa</span>
                </span>
              </label>
              <div className="my-4 rounded-lg bg-background p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold text-foreground">{formatEur(captainsTotal)}</p>
              </div>
              <Button className="h-11 w-full rounded-full bg-[#f06a5f] text-white hover:bg-[#e95f54]" onClick={handleCaptainsCheckout} disabled={isCaptainsCheckoutLoading}>
                {isCaptainsCheckoutLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
                Comprar Capitanes
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PricingPlans;
