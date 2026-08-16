import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";
const STRIPE_PRICE_CAPTAINS_TABLE = Deno.env.get("STRIPE_PRICE_CAPTAINS_TABLE") ?? "";
const STRIPE_PRICE_CAPTAINS_PACK = Deno.env.get("STRIPE_PRICE_CAPTAINS_PACK") ?? "";

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

const normalizeTableCount = (value: unknown) => {
  const count = Number(value);
  if (!Number.isFinite(count)) return null;
  return Math.max(1, Math.min(999, Math.floor(count)));
};

const fetchStripePrice = async (priceId: string) => {
  const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const price = await response.json();
  if (!response.ok || typeof price?.unit_amount !== "number" || !price?.currency) {
    console.error("stripe-create-checkout-session price lookup error:", price);
    return null;
  }
  return {
    unitAmount: price.unit_amount as number,
    currency: String(price.currency).toLowerCase(),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STRIPE_SECRET_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  try {
    const body = (await req.json()) as {
      planId?: string;
      tableCount?: number;
      captainPack?: boolean;
      quoteOnly?: boolean;
    };
    const planId = body.planId ?? "";

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (token) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (!userError && userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email ?? null;
      }
    }

    const params = new URLSearchParams();
    params.set("mode", "payment");

    if (userEmail) {
      params.set("customer_email", userEmail);
    }
    if (userId) {
      params.append("metadata[userId]", userId);
    }

    if (planId === "captains") {
      if (body.quoteOnly) {
        if (!STRIPE_PRICE_CAPTAINS_TABLE || !STRIPE_PRICE_CAPTAINS_PACK) {
          return json({ error: "MISSING_CAPTAINS_PRICE_ID" }, 500);
        }
        const [gamePrice, captainPackPrice] = await Promise.all([
          fetchStripePrice(STRIPE_PRICE_CAPTAINS_TABLE),
          fetchStripePrice(STRIPE_PRICE_CAPTAINS_PACK),
        ]);
        if (!gamePrice || !captainPackPrice || gamePrice.currency !== captainPackPrice.currency) {
          return json({ error: "INVALID_CAPTAINS_PRICE" }, 500);
        }
        return json({
          gameUnitAmount: gamePrice.unitAmount,
          captainPackUnitAmount: captainPackPrice.unitAmount,
          currency: gamePrice.currency,
        });
      }

      const tableCount = normalizeTableCount(body.tableCount);
      if (!tableCount) {
        return json({ error: "INVALID_TABLE_COUNT" }, 400);
      }
      const captainPack = Boolean(body.captainPack);
      if (!STRIPE_PRICE_CAPTAINS_TABLE || (captainPack && !STRIPE_PRICE_CAPTAINS_PACK)) {
        return json({ error: "MISSING_CAPTAINS_PRICE_ID" }, 500);
      }
      const onboardingParams = new URLSearchParams({
        checkout: "success",
        tableCount: String(tableCount),
        captainPack: captainPack ? "1" : "0",
      });

      params.set("success_url", `${APP_ORIGIN}/nuevoeventocapitanes?${onboardingParams.toString()}`);
      params.set("cancel_url", `${APP_ORIGIN}/planes?checkout=cancel`);
      params.append("line_items[0][price]", STRIPE_PRICE_CAPTAINS_TABLE);
      params.append("line_items[0][quantity]", String(tableCount));
      if (captainPack) {
        params.append("line_items[1][price]", STRIPE_PRICE_CAPTAINS_PACK);
        params.append("line_items[1][quantity]", String(tableCount));
      }
      params.append("metadata[planId]", "captains");
      params.append("metadata[tableCount]", String(tableCount));
      params.append("metadata[captainPack]", captainPack ? "true" : "false");
    } else {
      const plan = getPlanById(planId);
      if (!plan) {
        return json({ error: "INVALID_PLAN" }, 400);
      }

      const priceId = Deno.env.get(plan.stripePriceIdEnv) ?? "";
      if (!priceId) {
        return json({ error: "MISSING_PRICE_ID" }, 500);
      }

      params.set("success_url", `${APP_ORIGIN}/?checkout=success`);
      params.set("cancel_url", `${APP_ORIGIN}/?checkout=cancel`);
      params.append("line_items[0][price]", priceId);
      params.append("line_items[0][quantity]", "1");
      params.append("metadata[planId]", plan.id);
    }

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
