import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders },
});

const stripePost = async (path: string, params: URLSearchParams) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "STRIPE_ERROR");
  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!STRIPE_SECRET_KEY) return json({ error: "NO_STRIPE_KEY" }, 500);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || (data.user.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  try {
    const product = await stripePost("products", new URLSearchParams({
      name: "Carreteo",
      description: "Cámara desechable digital para eventos",
    }));

    const tiers = [
      { key: "carreteo_50", amount: "3900", cameras: "50" },
      { key: "carreteo_150", amount: "6900", cameras: "150" },
      { key: "carreteo_250", amount: "8500", cameras: "250" },
    ];

    const prices: Record<string, string> = {};
    for (const tier of tiers) {
      const price = await stripePost("prices", new URLSearchParams({
        product: product.id,
        currency: "eur",
        unit_amount: tier.amount,
        "metadata[plan]": tier.key,
        "metadata[max_cameras]": tier.cameras,
        "metadata[shots_per_camera]": "25",
        nickname: `Carreteo · Hasta ${tier.cameras} cámaras`,
      }));
      prices[tier.key] = price.id;
    }

    return json({ ok: true, product: product.id, prices });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "UNKNOWN" }, 500);
  }
});
