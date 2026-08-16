import { useMemo, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type CaptainsCheckoutCardProps = {
  compact?: boolean;
};

export const CaptainsCheckoutCard = ({ compact = false }: CaptainsCheckoutCardProps) => {
  const { toast } = useToast();
  const [tableCount, setTableCount] = useState(6);
  const [captainPack, setCaptainPack] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const gameSubtotal = useMemo(() => tableCount * 4.95, [tableCount]);
  const captainPackSubtotal = useMemo(() => (captainPack ? tableCount * 12.95 : 0), [captainPack, tableCount]);
  const total = gameSubtotal + captainPackSubtotal;

  const formatEur = (amount: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(amount);

  const handleCheckout = async () => {
    const cleanTableCount = Math.max(1, Math.min(999, Math.floor(tableCount || 1)));
    setTableCount(cleanTableCount);
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", {
        body: {
          planId: "captains",
          tableCount: cleanTableCount,
          captainPack,
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
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className={`grid gap-5 ${compact ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase text-[#f06a5f]">Capitanes</p>
            <h2 className="text-2xl font-bold text-foreground">Juego de Capitanes por mesa</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pago único calculado por número de mesas. Puedes añadir el pack Capitán como extra por mesa.
            </p>
          </div>
          <ul className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f06a5f]" /> 4,95 € por mesa</li>
            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#f06a5f]" /> Hasta 25 retos personalizables</li>
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
              value={tableCount}
              onChange={(event) => setTableCount(Math.max(1, Math.min(999, Number(event.target.value) || 1)))}
              className="h-11"
            />
          </label>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm">
            <input
              type="checkbox"
              checked={captainPack}
              onChange={(event) => setCaptainPack(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#f06a5f]"
            />
            <span>
              <span className="block font-medium text-foreground">Añadir pack Capitán</span>
              <span className="block text-muted-foreground">+12,95 € por mesa</span>
            </span>
          </label>
          <div className="my-4 rounded-lg bg-background p-3">
            <div className="mb-3 space-y-1 border-b border-border pb-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Juego ({tableCount} mesas × 4,95 €)</span>
                <span className="font-medium text-foreground">{formatEur(gameSubtotal)}</span>
              </div>
              {captainPack ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Pack ({tableCount} mesas × 12,95 €)</span>
                  <span className="font-medium text-foreground">{formatEur(captainPackSubtotal)}</span>
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-3xl font-bold text-foreground">{formatEur(total)}</p>
          </div>
          <Button className="h-11 w-full rounded-full bg-[#f06a5f] text-white hover:bg-[#e95f54]" onClick={handleCheckout} disabled={isLoading}>
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
            Comprar Capitanes
          </Button>
        </div>
      </div>
    </section>
  );
};
