import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${APP_ORIGIN}/?checkout=success`);
    params.set("cancel_url", `${APP_ORIGIN}/?checkout=cancel`);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    if (userData.user.email) {
      params.set("customer_email", userData.user.email);
    }
    params.set("metadata[planId]", plan.id);
    params.set("metadata[userId]", userData.user.id);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2023-10-16",
      },
      body: params,
    });

    if (!response.ok) {
      const detail = await response.text();
      return json({ error: "STRIPE_ERROR", detail }, 500);
    }

    const session = await response.json();
    return json({ url: session.url });
  } catch (error) {
    console.error("stripe-create-checkout-session error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
