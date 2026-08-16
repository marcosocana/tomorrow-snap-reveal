import { Check, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type TimeCapsuleCheckoutPlansProps = {
  customerEmail?: string | null;
};

const capsulePlans = [
  {
    name: "Evento Basic",
    messages: "Hasta 50 mensajes",
    price: "17 €",
    description: "Para un regalo íntimo y lleno de significado.",
    features: [
      "Textos, fotos, vídeos y audios",
      "Fecha de apertura personalizada",
      "Enlace y QR para compartir",
    ],
    checkoutUrl:
      import.meta.env.VITE_STRIPE_CAPSULE_URL_BASIC ??
      "https://buy.stripe.com/bJebIUgGZ6zsgIv8TR3ks07",
  },
  {
    name: "Evento Pro",
    messages: "Hasta 200 mensajes",
    price: "67 €",
    description: "La opción ideal para celebraciones con todos los tuyos.",
    features: [
      "Todo lo incluido en Basic",
      "Hasta 200 aportaciones",
      "Descarga de todos los recuerdos",
    ],
    checkoutUrl:
      import.meta.env.VITE_STRIPE_CAPSULE_URL_PRO ??
      "https://buy.stripe.com/cNibIU8at2jc4ZNeeb3ks09",
    featured: true,
    badge: "Más elegido",
  },
  {
    name: "Evento Sin límites",
    messages: "Mensajes ilimitados",
    price: "130 €",
    description: "Para grandes historias en las que todo el mundo cuenta.",
    features: [
      "Todo lo incluido en Pro",
      "Aportaciones ilimitadas",
      "Ideal para grandes eventos",
    ],
    checkoutUrl:
      import.meta.env.VITE_STRIPE_CAPSULE_URL_UNLIMITED ??
      "https://buy.stripe.com/aFabIU9ex1f83VJ3zx3ks08",
  },
] as const;

const withPrefilledEmail = (checkoutUrl: string, customerEmail?: string | null) => {
  if (!customerEmail) return checkoutUrl;

  const url = new URL(checkoutUrl);
  url.searchParams.set("prefilled_email", customerEmail);
  return url.toString();
};

export const TimeCapsuleCheckoutPlans = ({ customerEmail }: TimeCapsuleCheckoutPlansProps) => (
  <section className="space-y-6">
    <div className="text-center">
      <p className="text-sm text-muted-foreground">
        Un único pago, sin suscripciones. Todos los packs incluyen textos, fotos, vídeos y audios.
      </p>
    </div>

    <div className="grid items-stretch gap-4 md:grid-cols-3">
      {capsulePlans.map((plan) => (
        <article
          key={plan.name}
          className={`relative flex flex-col rounded-2xl border p-5 ${
            plan.featured
              ? "border-[#f06a5f]/60 bg-[#fef2f2] shadow-[0_20px_50px_-32px_rgba(240,106,95,0.6)]"
              : "border-border bg-card"
          }`}
        >
          {plan.badge ? (
            <span className="absolute right-4 top-4 rounded-full bg-[#f06a5f] px-3 py-1 text-xs font-semibold text-white">
              {plan.badge}
            </span>
          ) : null}

          <p className="pr-24 text-sm font-semibold text-muted-foreground">{plan.name}</p>
          <h3 className="mt-3 text-xl font-bold text-foreground">{plan.messages}</h3>
          <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
            {plan.description}
          </p>

          <div className="mt-5 flex items-end gap-2">
            <strong className="text-4xl font-bold tracking-tight text-foreground">{plan.price}</strong>
            <span className="pb-1 text-sm text-muted-foreground">pago único</span>
          </div>

          <div className="my-5 h-px bg-border" />
          <ul className="mb-6 space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#f06a5f]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            className="mt-auto w-full rounded-full bg-[#f06a5f] text-white hover:bg-[#e95f54]"
            asChild
          >
            <a href={withPrefilledEmail(plan.checkoutUrl, customerEmail)}>
              Comprar
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </article>
      ))}
    </div>

    <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4" />
      Pago seguro gestionado por Stripe.
    </p>
  </section>
);
