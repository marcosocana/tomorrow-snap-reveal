import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const user = userData.user;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .select("*")
      .eq("status", "paid")
      .is("redeemed_at", null)
      .or(`user_id.eq.${user.id},user_email.eq.${user.email}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (purchaseError) {
      console.error("redeem-pending query error:", purchaseError);
      return json({ error: "DB_ERROR" }, 500);
    }

    if (!purchase) {
      return json({ pending: null });
    }

    if (
      purchase.redeem_token_expires_at &&
      new Date(purchase.redeem_token_expires_at) < new Date()
    ) {
      return json({ pending: null });
    }

    const plan = getPlanById(purchase.plan_id);

    return json({
      pending: {
        token: purchase.redeem_token,
        plan: plan
          ? { id: plan.id, label: plan.label, maxPhotos: plan.maxPhotos, stripePriceIdEnv: plan.stripePriceIdEnv }
          : null,
        expiresAt: purchase.redeem_token_expires_at ?? null,
      },
    });
  } catch (error) {
    console.error("redeem-pending error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
