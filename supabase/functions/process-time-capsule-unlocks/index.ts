import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type UnlockJob = {
  event_id: string;
  unlock_password: string;
  attempts: number;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_PUBLISHABLE_KEYS = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const LOGO_URL = Deno.env.get("LOGO_URL") ?? "https://acceso.revelao.cam/LogoMiniRevelao.svg";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const allowedApiKeys = () => {
  const keys = new Set<string>();
  if (SUPABASE_ANON_KEY) keys.add(SUPABASE_ANON_KEY);
  try {
    const parsed = JSON.parse(SUPABASE_PUBLISHABLE_KEYS) as Record<string, string> | string[];
    if (Array.isArray(parsed)) parsed.forEach((key) => keys.add(key));
    else Object.values(parsed).forEach((key) => keys.add(key));
  } catch {
    if (SUPABASE_PUBLISHABLE_KEYS.startsWith("sb_publishable_")) keys.add(SUPABASE_PUBLISHABLE_KEYS);
  }
  return keys;
};

const getCapsuleYears = (limitsJson: unknown) => {
  if (!limitsJson || typeof limitsJson !== "object" || Array.isArray(limitsJson)) return 5;
  const capsule = (limitsJson as Record<string, unknown>).capsule;
  if (!capsule || typeof capsule !== "object" || Array.isArray(capsule)) return 5;
  const years = (capsule as Record<string, unknown>).years;
  return typeof years === "number" && Number.isFinite(years) && years > 0 ? years : 5;
};

const sendUnlockEmail = async (
  to: string,
  eventId: string,
  eventName: string,
  password: string,
  years: number,
) => {
  const eventUrl = `https://acceso.revelao.cam/event-form/${eventId}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: `Ya puedes descapsular ${eventName}`,
      html: `<!doctype html><html><body style="margin:0;background:#f7f3ee;font-family:Arial,sans-serif;color:#211a17;">
        <div style="max-width:560px;margin:0 auto;padding:32px 18px;">
          <div style="background:#fff;border-radius:18px;padding:32px;text-align:center;border:1px solid #eadfd7;">
            <img src="${LOGO_URL}" alt="Revelao" style="height:58px;width:auto;margin-bottom:20px;" />
            <h1 style="font-size:25px;margin:0 0 14px;">Tu cápsula ya está lista</h1>
            <p style="font-size:16px;line-height:1.6;color:#5f514a;margin:0 0 14px;">Ha terminado el evento <strong>${escapeHtml(eventName)}</strong>. Ya puedes abrir y descargar todos los vídeos desde el detalle del evento.</p>
            <p style="font-size:15px;line-height:1.6;color:#5f514a;margin:0 0 20px;">Tú eliges: puedes descargarlos ahora o mantener la sorpresa y esperar los ${years} años previstos para descapsularlos.</p>
            <p style="font-size:13px;color:#8b7b72;margin:0 0 8px;">Contraseña de descapsulamiento</p>
            <div style="display:inline-block;background:#f5eee9;border:1px solid #eadfd7;border-radius:12px;padding:14px 20px;font-family:monospace;font-size:22px;font-weight:700;letter-spacing:3px;margin-bottom:24px;">${escapeHtml(password)}</div><br />
            <a href="${eventUrl}" style="display:inline-block;background:#f06a5f;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700;">Abrir mi cápsula</a>
            <p style="font-size:12px;line-height:1.5;color:#8b7b72;margin:20px 0 0;">Guarda este email y la contraseña: podrás acceder al contenido ahora o cuando llegue el momento de abrir vuestra cápsula.</p>
          </div>
        </div></body></html>`,
    }),
  });
  if (!response.ok) throw new Error(`RESEND_${response.status}:${await response.text()}`);
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
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await admin.rpc("claim_time_capsule_unlock_jobs", {
    worker_now: now,
    stale_before: stale,
    batch_limit: 50,
  });
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ eventId: string; status: string; error?: string }> = [];
  for (const job of (data ?? []) as UnlockJob[]) {
    try {
      const { data: event, error: eventError } = await admin.from("events")
        .select("id,name,owner_id,upload_end_time,plan_id,type,limits_json")
        .eq("id", job.event_id).single();
      if (eventError || !event) throw new Error("EVENT_NOT_FOUND");
      if (event.plan_id !== "capsule" && event.type !== "capsule") throw new Error("NOT_A_CAPSULE");
      if (!event.owner_id) throw new Error("OWNER_NOT_FOUND");

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(event.owner_id);
      const email = userData.user?.email?.trim().toLowerCase();
      if (userError || !email) throw new Error("OWNER_EMAIL_NOT_FOUND");
      await sendUnlockEmail(
        email,
        event.id,
        event.name,
        job.unlock_password,
        getCapsuleYears(event.limits_json),
      );
      await admin.from("time_capsule_unlock_credentials").update({
        status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
      }).eq("event_id", job.event_id);
      results.push({ eventId: job.event_id, status: "sent" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      await admin.from("time_capsule_unlock_credentials").update({
        status: "pending", last_error: message.slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq("event_id", job.event_id);
      results.push({ eventId: job.event_id, status: "failed", error: message });
    }
  }
  return json({ processed: results.length, results });
});
