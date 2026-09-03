import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "npm:stripe@22.4.0";
import { getPlanById, getPlanByPriceId } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-07-29.dahlia",
  httpClient: Stripe.createFetchHttpClient(),
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const generateRedeemToken = (length = 16) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
};

type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

type PurchaseRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  redeem_token: string;
  status: string;
};

const resolveCustomerEmail = async (session: Stripe.Checkout.Session) => {
  const directEmail = session.customer_details?.email || session.customer_email;
  if (directEmail) return directEmail.trim().toLowerCase();
  if (typeof session.customer !== "string") return null;
  const customer = await stripe.customers.retrieve(session.customer);
  if (customer.deleted || !customer.email) return null;
  return customer.email.trim().toLowerCase();
};

const recordWebhookEvent = async (
  admin: SupabaseAdminClient,
  event: Stripe.Event,
  sessionId: string | null,
  status: "processing" | "processed" | "ignored" | "failed",
  lastError: string | null = null,
) => {
  const { error } = await admin.from("stripe_webhook_events").upsert({
    event_id: event.id,
    event_type: event.type,
    stripe_session_id: sessionId,
    status,
    last_error: lastError?.slice(0, 1000) ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_id" });
  if (error) console.error("stripe-webhook event ledger error:", error.message);
};

const ensurePurchase = async (
  admin: SupabaseAdminClient,
  values: {
    user_id: string | null;
    user_email: string;
    stripe_session_id: string;
    plan_id: string;
    redeem_token: string;
    redeem_token_expires_at: string;
  },
) => {
  const { error: insertError } = await admin.from("purchases")
    .upsert({ ...values, status: "paid" }, { onConflict: "stripe_session_id", ignoreDuplicates: true });
  if (insertError) throw new Error(`PURCHASE_INSERT_FAILED:${insertError.message}`);

  const { data, error: readError } = await admin.from("purchases")
    .select("id,user_id,user_email,redeem_token,status")
    .eq("stripe_session_id", values.stripe_session_id).single();
  if (readError || !data) throw new Error(`PURCHASE_READ_FAILED:${readError?.message ?? "not found"}`);
  const purchase = data as PurchaseRow;

  if ((values.user_id && !purchase.user_id) || (!purchase.user_email && values.user_email)) {
    const { error: patchError } = await admin.from("purchases").update({
      user_id: purchase.user_id || values.user_id,
      user_email: purchase.user_email || values.user_email,
    }).eq("id", purchase.id);
    if (patchError) throw new Error(`PURCHASE_PATCH_FAILED:${patchError.message}`);
  }
  return purchase;
};

const enqueueEmail = async (
  admin: SupabaseAdminClient,
  values: {
    stripe_event_id: string;
    stripe_session_id: string;
    purchase_id: string;
    email_type: "revelao_purchase" | "captains_purchase";
    recipient: string;
    payload: Record<string, unknown>;
  },
) => {
  const { error } = await admin.from("purchase_email_outbox")
    .upsert(values, { onConflict: "stripe_session_id,email_type", ignoreDuplicates: true });
  if (error) throw new Error(`EMAIL_ENQUEUE_FAILED:${error.message}`);
};

const fulfillPaidSession = async (
  admin: SupabaseAdminClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) => {
  if (session.payment_status !== "paid") return "waiting_for_payment";

  const userEmail = await resolveCustomerEmail(session);
  if (!userEmail) throw new Error("CUSTOMER_EMAIL_NOT_FOUND");
  const userId = session.metadata?.userId || null;

  const planId = session.metadata?.planId || "";
  if (planId === "captains") {
    const requestedTableCount = Number(session.metadata?.tableCount || 1);
    const tableCount = Number.isFinite(requestedTableCount)
      ? Math.max(1, Math.min(999, Math.floor(requestedTableCount)))
      : 1;
    const captainPack = session.metadata?.captainPack === "true";
    const redeemToken = generateRedeemToken(16);
    const redeemExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
    const purchase = await ensurePurchase(admin, {
      user_id: userId,
      user_email: userEmail,
      stripe_session_id: session.id,
      plan_id: "captains",
      redeem_token: redeemToken,
      redeem_token_expires_at: redeemExpiresAt,
    });
    const creationCode = purchase.redeem_token;

    const { error: codeInsertError } = await admin.from("captains_creation_codes").upsert({
      code: creationCode,
      created_by: null,
      account_owner_id: userId,
      expires_at: redeemExpiresAt,
      max_tables: tableCount,
    }, { onConflict: "code", ignoreDuplicates: true });
    if (codeInsertError) throw new Error(`CAPTAINS_CODE_FAILED:${codeInsertError.message}`);

    if (userId) {
      const { error: ownerError } = await admin.from("captains_creation_codes")
        .update({ account_owner_id: userId }).eq("code", creationCode).is("account_owner_id", null);
      if (ownerError) throw new Error(`CAPTAINS_OWNER_FAILED:${ownerError.message}`);
    }

    const onboardingParams = new URLSearchParams({
      code: creationCode,
      tableCount: String(tableCount),
      captainPack: captainPack ? "1" : "0",
    });
    const onboardingPath = `/nuevoeventocapitanes?${onboardingParams.toString()}`;
    await enqueueEmail(admin, {
      stripe_event_id: event.id,
      stripe_session_id: session.id,
      purchase_id: purchase.id,
      email_type: "captains_purchase",
      recipient: userEmail,
      payload: {
        onboardingUrl: `${APP_ORIGIN}/admin-login?redirect=${encodeURIComponent(onboardingPath)}`,
        creationCode,
        tableCount,
        captainPack,
        totalAmount: session.amount_total,
        currency: session.currency,
      },
    });
    return "captains_enqueued";
  }

  let plan = getPlanById(planId);
  if (!plan) {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    plan = getPlanByPriceId(lineItems.data[0]?.price?.id ?? null, session.livemode);
  }
  if (!plan) throw new Error("UNKNOWN_PLAN");

  const redeemToken = generateRedeemToken(16);
  const redeemExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const purchase = await ensurePurchase(admin, {
    user_id: userId,
    user_email: userEmail,
    stripe_session_id: session.id,
    plan_id: plan.id,
    redeem_token: redeemToken,
    redeem_token_expires_at: redeemExpiresAt,
  });
  const finalToken = purchase.redeem_token;
  const capsulePath = `/event-form?product=capsule&redeem=${encodeURIComponent(finalToken)}`;
  const redeemUrl = plan.product === "capsule"
    ? `${APP_ORIGIN}/admin-login?email=${encodeURIComponent(userEmail)}&redirect=${encodeURIComponent(capsulePath)}`
    : `${APP_ORIGIN}/redeem/${finalToken}`;
  await enqueueEmail(admin, {
    stripe_event_id: event.id,
    stripe_session_id: session.id,
    purchase_id: purchase.id,
    email_type: "revelao_purchase",
    recipient: userEmail,
    payload: { redeemUrl, planLabel: plan.label, redeemCode: finalToken },
  });
  return "revelao_enqueued";
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return json({ error: "Missing env" }, 500);
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      STRIPE_WEBHOOK_SECRET,
      300,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    console.error("stripe-webhook invalid signature:", error instanceof Error ? error.message : error);
    return json({ error: "Invalid signature" }, 400);
  }

  const handledTypes = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]);
  if (!handledTypes.has(event.type)) return json({ received: true, ignored: true });

  const session = event.data.object as Stripe.Checkout.Session;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await recordWebhookEvent(admin, event, session.id, "processing");

  if (event.type === "checkout.session.async_payment_failed") {
    await recordWebhookEvent(admin, event, session.id, "ignored", "ASYNC_PAYMENT_FAILED");
    return json({ received: true, payment: "failed" });
  }

  try {
    const result = await fulfillPaidSession(admin, event, session);
    await recordWebhookEvent(admin, event, session.id, result === "waiting_for_payment" ? "ignored" : "processed", result);
    return json({ received: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("stripe-webhook fulfillment error:", message);
    await recordWebhookEvent(admin, event, session.id, "failed", message);
    return json({ error: "FULFILLMENT_FAILED" }, 500);
  }
});
