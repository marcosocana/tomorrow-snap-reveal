import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (text: string) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  try {
    const { token, password } = (await req.json()) as {
      token?: string;
      password?: string;
    };
    if (!token || !password || password.length < 8) {
      return json({ error: "INVALID_INPUT" }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tokenHash = await sha256(token);

    const { data: reset, error: resetError } = await supabaseAdmin
      .from("password_resets")
      .select("id,user_id,expires_at,used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (resetError || !reset?.user_id) {
      return json({ error: "INVALID_TOKEN" }, 400);
    }

    if (reset.used_at) {
      return json({ error: "TOKEN_USED" }, 400);
    }

    if (new Date(reset.expires_at) < new Date()) {
      return json({ error: "TOKEN_EXPIRED" }, 400);
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      reset.user_id,
      { password },
    );

    if (updateError) {
      return json({ error: "UPDATE_FAILED", detail: updateError.message }, 500);
    }

    await supabaseAdmin
      .from("password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", reset.id);

    return json({ ok: true });
  } catch (error) {
    console.error("reset-password error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
