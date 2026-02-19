import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const baseFeatures = [
  "Fotos ilimitadas",
  "Galería privada 20 días",
  "Descarga en alta calidad",
  "Personalización de marca",
  "Soporte para dudas",
];

const plans = [
  {
    title: "Pequeño",
    guests: 50,
    price: "36€",
    costPerGuest: "0,72€",
    stripeUrl: "https://buy.stripe.com/cNiaEY0i9gnpbi4dL60Fi03",
    cta: "Elegir",
  },
  {
    title: "Mediano",
    guests: 300,
    price: "74€",
    costPerGuest: "0,25€",
    stripeUrl: "https://buy.stripe.com/14A5kE9SJgnpeuggXi0Fi02",
    cta: "Elegir",
    featured: true,
    badge: "Más popular",
  },
  {
    title: "Grande",
    guests: 500,
    price: "96€",
    costPerGuest: "0,19€",
    stripeUrl: "https://buy.stripe.com/dRm8wQ4yp5IL85S7mI0Fi04",
    cta: "Elegir",
  },
  {
    title: "XL",
    guests: 1000,
    price: "139€",
    costPerGuest: "0,14€",
    stripeUrl: "https://buy.stripe.com/fZu28sd4VefhgCo5eA0Fi05",
    cta: "Elegir",
  },
];

const whatsappMessage = "Hola! Acabo de crear un evento demo y quiero contratar un plan. ¿Me ayudas?";

export const PricingPreview = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-foreground">Planes para tu evento real</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Empieza gratis con la demo y pasa al plan que mejor se ajuste a tu aforo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.title}
            className={[
              "relative rounded-2xl border bg-card p-5 shadow-sm transition-transform duration-300",
              "hover:-translate-y-1",
              plan.featured ? "border-primary/40 bg-primary/5 shadow-[0_20px_60px_-30px_rgba(180,38,38,0.35)]" : "border-border",
            ].join(" ")}
          >
            {plan.badge ? (
              <span className="absolute right-5 top-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1">
                {plan.badge}
              </span>
            ) : null}

            <div className="mb-5">
              <h4 className="text-lg font-semibold text-foreground mb-1">{plan.title}</h4>
              <p className="text-xs text-muted-foreground">Hasta {plan.guests} invitados</p>
              <div className="flex items-end gap-2 mt-3">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-xs text-muted-foreground pb-1">/evento</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {plan.costPerGuest} por invitado
              </p>
            </div>

            <ul className="space-y-2.5 mb-5">
              {baseFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                  <span className="text-xs text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              variant={plan.featured ? "default" : "outline"}
              asChild
            >
              <a href={plan.stripeUrl} target="_blank" rel="noopener noreferrer">
                {plan.cta}
              </a>
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        ¿Más de 1000 invitados?{" "}
        <a
          className="text-foreground font-semibold hover:underline"
          href={`https://wa.me/34695834018?text=${encodeURIComponent(whatsappMessage)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Escríbenos por WhatsApp
        </a>
        .
      </p>
    </div>
  );
};
