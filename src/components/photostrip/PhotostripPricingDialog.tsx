import { useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

const plans = [
  { id: "photostrip_100", name: "Pack 100", price: 29, limit: "Hasta 100 tiras", ideal: "Ideal para celebraciones íntimas", featured: false },
  { id: "photostrip_200", name: "Pack 200", price: 49, limit: "Hasta 200 tiras", ideal: "Ideal para bodas y eventos medianos", featured: true },
  { id: "photostrip_unlimited", name: "Ilimitado", price: 79, limit: "Tiras ilimitadas", ideal: "Ideal para eventos grandes", featured: false },
] as const;

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export const PhotostripPricingDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const checkout = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", { body: { planId } });
      if (error || !data?.url) throw error || new Error("CHECKOUT_URL_MISSING");
      window.location.assign(data.url);
    } catch (error) {
      console.error("Photostrip checkout error:", error);
      toast({ title: "No se pudo iniciar el pago", description: "Inténtalo de nuevo en unos segundos.", variant: "destructive" });
      setLoadingPlan(null);
    }
  };

  const formatEur = (amount: number) => new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);

  const renderPlan = (plan: (typeof plans)[number]) => (
    <article
      key={plan.id}
      className={[
        "relative flex h-full w-full max-w-[360px] flex-col rounded-3xl border bg-card p-6 shadow-sm",
        plan.featured
          ? "border-[#f06a5f]/60 bg-[#fef2f2] shadow-[0_24px_60px_-28px_rgba(240,106,95,0.45)]"
          : "border-border",
      ].join(" ")}
    >
      {plan.featured ? <span className="absolute right-5 top-5 rounded-full bg-[#f06a5f] px-3 py-1 text-xs font-semibold text-white shadow-sm">Más popular</span> : null}
      <div className="mb-6 space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">Tu fotomatón digital para un evento</p>
        <div className="flex items-end gap-2 pt-1">
          <span className="text-4xl font-bold text-foreground">{formatEur(plan.price)}</span>
          <span className="pb-1 text-sm text-muted-foreground">por evento</span>
        </div>
      </div>
      <ul className="mb-6 space-y-3">
        {[plan.limit, "Código QR de acceso", "Personalización", "Galería compartida"].map((feature) => (
          <li key={feature} className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#f06a5f]" /><span className="text-sm text-foreground">{feature}</span></li>
        ))}
        <li className="flex items-start gap-3"><Star className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /><span className="text-sm text-foreground">{plan.ideal}</span></li>
      </ul>
      <Button className="mt-auto w-full bg-[#f06a5f] text-white hover:bg-[#e95f54]" disabled={Boolean(loadingPlan)} onClick={() => void checkout(plan.id)}>
        {loadingPlan === plan.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Abriendo pago…</> : "Elegir plan"}
      </Button>
    </article>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loadingPlan) onOpenChange(next); }}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none p-4 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-7xl sm:rounded-lg sm:p-6 xl:max-w-[1480px]">
        <DialogHeader>
          <DialogTitle>Crear un evento Photostrip</DialogTitle>
          <DialogDescription>Elige el plan que mejor se adapte a tu evento. El pago es único y recibirás por email el enlace para crearlo.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-90px)] overflow-y-auto pr-1 sm:max-h-[80vh]">
          <div className="py-5 md:hidden">
            <Carousel opts={{ align: "start" }} className="w-full">
              <CarouselContent className="ml-0">
                {plans.map((plan) => <CarouselItem key={plan.id} className="basis-[85%] pl-0 pr-4 sm:basis-1/2">{renderPlan(plan)}</CarouselItem>)}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:inline-flex" />
              <CarouselNext className="hidden sm:inline-flex" />
            </Carousel>
          </div>
          <div className="mx-auto hidden max-w-[1128px] gap-6 py-6 md:grid md:grid-cols-2 md:justify-items-center lg:grid-cols-3">
            {plans.map(renderPlan)}
          </div>
          <p className="pb-2 text-center text-sm text-muted-foreground">Todos los planes incluyen el diseño y la descarga de la tira Photostrip.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
