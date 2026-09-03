import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PurchaseEmailJob, sendPurchaseEmail } from "../_shared/purchaseEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_PUBLISHABLE_KEYS = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const LOGO_URL = Deno.env.get("LOGO_URL") ?? "https://acceso.revelao.cam/LogoTransparent.png";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const allowedApiKeys = () => {
  const keys = new Set<string>();
  if (SUPABASE_ANON_KEY) keys.add(SUPABASE_ANON_KEY);
  try {
    const parsed = JSON.parse(SUPABASE_PUBLISHABLE_KEYS) as Record<string, string> | string[];
    (Array.isArray(parsed) ? parsed : Object.values(parsed)).forEach((key) => keys.add(key));
  } catch {
    if (SUPABASE_PUBLISHABLE_KEYS.startsWith("sb_publishable_")) keys.add(SUPABASE_PUBLISHABLE_KEYS);
  }
  return keys;
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = req.headers.get("apikey") ?? "";
  if (!apiKey || !allowedApiKeys().has(apiKey)) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !FROM_EMAIL) {
    return json({ error: "Missing server configuration" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const { data, error } = await admin.rpc("claim_purchase_email_jobs", {
    worker_now: now.toISOString(),
    stale_before: new Date(now.getTime() - 10 * 60_000).toISOString(),
    batch_limit: 25,
  });
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const job of (data ?? []) as PurchaseEmailJob[]) {
    try {
      const providerMessageId = await sendPurchaseEmail(job, {
        resendApiKey: RESEND_API_KEY,
        fromEmail: FROM_EMAIL,
        logoUrl: LOGO_URL,
      });
      const { error: updateError } = await admin.from("purchase_email_outbox").update({
        status: "sent",
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      if (updateError) throw updateError;
      results.push({ id: job.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const dead = job.attempts >= 6;
      const delayMinutes = [1, 5, 15, 60, 360][Math.min(job.attempts - 1, 4)];
      await admin.from("purchase_email_outbox").update({
        status: dead ? "dead" : "pending",
        next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      results.push({ id: job.id, status: dead ? "dead" : "retry", error: message });
    }
  }

  return json({ processed: results.length, results });
});
