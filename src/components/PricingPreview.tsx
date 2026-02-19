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
    <div className="space-y-10">
      <div className="text-center space-y-2">
        <h3 className="text-3xl md:text-4xl font-semibold text-foreground">
          Precio
        </h3>
        <p className="text-sm md:text-base text-muted-foreground">
          Elige el plan ideal según el tamaño de tu evento
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.title}
            className={[
              "relative rounded-3xl border bg-card p-6 shadow-sm transition-all duration-300",
              "hover:-translate-y-1",
              plan.featured
                ? "border-[#f06a5f]/40 bg-[#f06a5f]/5 shadow-[0_20px_40px_-30px_rgba(240,106,95,0.35)]"
                : "border-border",
            ].join(" ")}
          >
            {plan.badge ? (
              <span className="absolute right-5 top-5 rounded-full bg-[#f06a5f] text-white text-xs font-semibold px-3 py-1 shadow-sm">
                {plan.badge}
              </span>
            ) : null}

            <div className="mb-6 space-y-2">
              <h4 className="text-lg font-semibold text-foreground">{plan.title}</h4>
              <p className="text-sm text-muted-foreground">Hasta {plan.guests} invitados</p>
              <div className="flex items-end gap-2 pt-1">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground pb-1">/evento</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {plan.costPerGuest} por invitado
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
              asChild
            >
              <a href={plan.stripeUrl} target="_blank" rel="noopener noreferrer">
                {plan.cta}
              </a>
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
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
