import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById, PLANS } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";
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
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
      ${LOGO_URL ? `<p style="text-align:center;"><img src="${LOGO_URL}" alt="Logo" style="height:48px;" /></p>` : ""}
      <h2 style="text-align:center;">Tu plan ${planLabel} ya está listo</h2>
      <p style="text-align:center;">
        Puedes crear tu evento usando el siguiente enlace:
      </p>
      <p style="text-align:center;">
        <a href="${redeemUrl}" style="display:inline-block;background:#f06a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
          Crear mi evento
        </a>
      </p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-top:24px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#888;">Código de canje</p>
        <p style="margin:0;font-size:20px;font-weight:bold;letter-spacing:2px;">${redeemCode}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#888;">Guarda este código por si necesitas acceder de nuevo.</p>
      </div>
      <p style="text-align:center;font-size:12px;color:#aaa;margin-top:24px;">
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

const getPlanByPriceId = (priceId: string | null | undefined) => {
  if (!priceId) return null;
  return Object.values(PLANS).find((plan) => Deno.env.get(plan.stripePriceIdEnv) === priceId) ?? null;
};

const fetchStripeJson = async (path: string) => {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Stripe API error:", data);
    return null;
  }
  return data;
};

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").reduce((acc, part) => {
    const [k, v] = part.split("=");
    acc[k.trim()] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === sig;
}

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

  const rawBody = await req.text();
  const isValid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(rawBody);

  if (event.type !== "checkout.session.completed") {
    return json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return json({ received: true });
  }

  const planId = session.metadata?.planId || "";
  let plan = getPlanById(planId);
  if (!plan) {
    const lineItems = await fetchStripeJson(`checkout/sessions/${session.id}/line_items?limit=1`);
    const priceId = lineItems?.data?.[0]?.price?.id ?? null;
    plan = getPlanByPriceId(priceId);
  }
  if (!plan) {
    return json({ error: "Unknown plan" }, 400);
  }

  const userId = session.metadata?.userId || null;
  const userEmail = session.customer_email || session.customer_details?.email || null;

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
