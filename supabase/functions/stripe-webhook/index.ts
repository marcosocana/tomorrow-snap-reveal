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
const LOGO_URL = Deno.env.get("LOGO_URL") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const sendRedeemEmail = async (to: string, redeemUrl: string, planLabel: string, redeemCode: string) => {
  if (!RESEND_API_KEY || !FROM_EMAIL) return;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      ${LOGO_URL ? `<div style="text-align:center;margin-bottom:24px;"><img src="${LOGO_URL}" alt="Revelao" style="width:240px; height:auto;" /></div>` : ""}
      <h2 style="margin: 0 0 8px; text-align:center;">Tu plan ${planLabel} ya está listo</h2>
      <p style="margin: 0 0 16px; text-align:center;">
        Puedes crear tu evento usando el siguiente enlace:
      </p>
      <div style="text-align:center; margin: 0 0 24px;">
        <a href="${redeemUrl}" style="display:inline-block;padding:12px 18px;background:#f06a5f;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
          Crear mi evento
        </a>
      </div>
      <div style="background:#f5f5f5;border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 8px;font-weight:700;">Código de canje</p>
        <p style="margin:0 0 4px;font-size:18px;letter-spacing:1px;"><strong>${redeemCode}</strong></p>
        <p style="margin:0;color:#666;font-size:12px;">Guarda este código por si necesitas acceder de nuevo.</p>
      </div>
      <p style="font-size:12px;color:#666;margin-top:16px;text-align:center;">
        Si no solicitaste esto, ignora este correo.
      </p>
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
  const generateRedeemToken = (length = 16) => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    let token = "";
    for (let i = 0; i < length; i++) {
      token += alphabet[values[i] % alphabet.length];
    }
    return token;
  };

  const redeemToken = generateRedeemToken(16);
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
    await sendRedeemEmail(userEmail, redeemUrl, plan.label, redeemToken);
  }

  return json({ received: true });
});
