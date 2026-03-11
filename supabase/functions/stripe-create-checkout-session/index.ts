import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

type StripePrice = {
  id: string;
  unit_amount: number | null;
  currency: string;
  product: string;
};

const getStripePrice = async (priceId: string): Promise<StripePrice | null> => {
  const response = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("stripe-create-checkout-session price lookup error:", data);
    return null;
  }
  return data as StripePrice;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  try {
    const { planId } = (await req.json()) as { planId?: string };
    const plan = getPlanById(planId ?? "");
    if (!plan) {
      return json({ error: "INVALID_PLAN" }, 400);
    }

    const priceId = Deno.env.get(plan.stripePriceIdEnv) ?? "";
    if (!priceId) {
      return json({ error: "MISSING_PRICE_ID" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: byUserId, error: byUserIdError } = await supabaseAdmin
      .from("referral_attributions")
      .select("id")
      .eq("referred_user_id", userData.user.id)
      .limit(1);

    if (byUserIdError) {
      console.error("stripe-create-checkout-session referral lookup byUserId error:", byUserIdError);
    }

    let hasReferral = Boolean(byUserId && byUserId.length > 0);
    if (!hasReferral && userData.user.email) {
      const { data: byEmail, error: byEmailError } = await supabaseAdmin
        .from("referral_attributions")
        .select("id")
        .ilike("referred_email", userData.user.email.trim().toLowerCase())
        .limit(1);
      if (byEmailError) {
        console.error("stripe-create-checkout-session referral lookup byEmail error:", byEmailError);
      }
      hasReferral = Boolean(byEmail && byEmail.length > 0);
    }

    const discountEligible = hasReferral && plan.id !== "small";
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${APP_ORIGIN}/?checkout=success`);
    params.set("cancel_url", `${APP_ORIGIN}/?checkout=cancel`);

    if (discountEligible) {
      const basePrice = await getStripePrice(priceId);
      if (!basePrice?.unit_amount || !basePrice.currency || !basePrice.product) {
        return json({ error: "INVALID_PRICE_DATA" }, 500);
      }
      const discountedAmount = Math.max(1, Math.round(basePrice.unit_amount * 0.7));
      params.append("line_items[0][price_data][currency]", basePrice.currency);
      params.append("line_items[0][price_data][product]", basePrice.product);
      params.append("line_items[0][price_data][unit_amount]", String(discountedAmount));
      params.append("line_items[0][quantity]", "1");
      params.append("metadata[referralDiscountPercent]", "30");
      params.append("metadata[baseStripePriceId]", priceId);
    } else {
      params.append("line_items[0][price]", priceId);
      params.append("line_items[0][quantity]", "1");
    }

    if (userData.user.email) {
      params.set("customer_email", userData.user.email);
    }
    params.append("metadata[planId]", plan.id);
    params.append("metadata[userId]", userData.user.id);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await response.json();
    if (!response.ok || !session?.url) {
      console.error("stripe-create-checkout-session error:", session);
      return json({ error: "CHECKOUT_CREATE_FAILED" }, 500);
    }

    return json({ url: session.url });
  } catch (error) {
    console.error("stripe-create-checkout-session error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
