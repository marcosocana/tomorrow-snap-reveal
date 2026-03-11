import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateReferralCode = (length = 8) => {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += codeChars[values[i] % codeChars.length];
  }
  return out;
};

const buildReferralLink = (code: string) =>
  `${APP_ORIGIN}/nuevoeventodemo?ref=${encodeURIComponent(code)}`;

const getUserIdFromToken = async (token: string) => {
  const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data?.user?.id) {
    return null;
  }
  return data.user.id;
};

const ensureReferralCode = async (supabaseAdmin: ReturnType<typeof createClient>, userId: string) => {
  const { data: existing } = await supabaseAdmin
    .from("referral_codes")
    .select("id, code, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing;

  for (let i = 0; i < 10; i++) {
    const code = generateReferralCode(8);
    const { data, error } = await supabaseAdmin
      .from("referral_codes")
      .insert({
        user_id: userId,
        code,
        is_active: true,
      })
      .select("id, code, is_active")
      .single();

    if (!error && data) return data;
    if (error && !String(error.message).toLowerCase().includes("duplicate")) {
      throw error;
    }
  }

  throw new Error("Unable to generate referral code");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  const userId = await getUserIdFromToken(token);
  if (!userId) {
    return json({ error: "UNAUTHORIZED" }, 401);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const active = Boolean(body?.active);
      const codeRow = await ensureReferralCode(supabaseAdmin, userId);

      const { data: updatedCode, error: updateError } = await supabaseAdmin
        .from("referral_codes")
        .update({ is_active: active })
        .eq("id", codeRow.id)
        .select("id, code, is_active")
        .single();

      if (updateError) throw updateError;

      return json({
        code: updatedCode.code,
        active: updatedCode.is_active,
        link: buildReferralLink(updatedCode.code),
      });
    }

    if (req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const { data: codeRow } = await supabaseAdmin
      .from("referral_codes")
      .select("id, code, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    const { data: attributions, error: attrError } = await supabaseAdmin
      .from("referral_attributions")
      .select("id, converted_at")
      .eq("referrer_user_id", userId);

    if (attrError) throw attrError;

    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from("referral_rewards")
      .select("amount_eur, status")
      .eq("referrer_user_id", userId);

    if (rewardsError) throw rewardsError;

    const totalSignups = attributions?.length ?? 0;
    const totalConversions = attributions?.filter((item) => Boolean(item.converted_at)).length ?? 0;
    const totalRewards = (rewards ?? []).reduce((sum, reward) => sum + Number(reward.amount_eur ?? 0), 0);
    const pendingRewards = (rewards ?? [])
      .filter((reward) => reward.status === "pending" || reward.status === "approved")
      .reduce((sum, reward) => sum + Number(reward.amount_eur ?? 0), 0);

    return json({
      code: codeRow?.code ?? null,
      active: codeRow?.is_active ?? false,
      link: codeRow?.code ? buildReferralLink(codeRow.code) : null,
      stats: {
        totalSignups,
        totalConversions,
        totalRewards,
        pendingRewards,
      },
    });
  } catch (error) {
    console.error("referrals error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
