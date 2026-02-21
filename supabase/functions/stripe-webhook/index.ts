import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.10.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://www.revelao.cam";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sendRedeemEmail = async (to: string, redeemUrl: string, planLabel: string) => {
  if (!RESEND_API_KEY || !FROM_EMAIL) return;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h2 style="margin: 0 0 8px;">Tu plan ${planLabel} ya está listo</h2>
      <p style="margin: 0 0 12px;">
        Usa este enlace para crear tu evento de pago:
      </p>
      <p style="margin: 0 0 16px;">
        <a href="${redeemUrl}" style="color:#f06a5f; font-weight:700;">Crear mi evento</a>
      </p>
      <p style="font-size:12px;color:#666;">Si no solicitaste esto, ignora este correo.</p>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: "Tu enlace para crear el evento",
      html,
    }),
  });
};

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return json({ error: "Missing env" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing signature" }, 400);
  }

  const body = await req.text();
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return json({ error: "Invalid signature" }, 400);
  }

  if (event.type !== "checkout.session.completed") {
    return json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return json({ received: true });
  }

  const planId = session.metadata?.planId || "";
  const plan = getPlanById(planId);
  if (!plan) {
    return json({ error: "Unknown plan" }, 400);
  }

  const userId = session.metadata?.userId || null;
  const userEmail = session.customer_email || session.customer_details?.email || null;
  const redeemToken = crypto.randomUUID();
  const redeemExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: inserted, error } = await supabaseAdmin
    .from("purchases")
    .upsert(
      {
        user_id: userId,
        user_email: userEmail,
        stripe_session_id: session.id,
        plan_id: plan.id,
        status: "paid",
        redeem_token: redeemToken,
        redeem_token_expires_at: redeemExpiresAt,
      },
      { onConflict: "stripe_session_id" },
    )
    .select()
    .maybeSingle();

  if (error) {
    console.error("Insert purchase error:", error);
    return json({ error: "DB error" }, 500);
  }

  if (userEmail) {
    const redeemUrl = `${APP_ORIGIN}/redeem/${inserted?.redeem_token || redeemToken}`;
    await sendRedeemEmail(userEmail, redeemUrl, plan.label);
  }

  return json({ received: true });
});
