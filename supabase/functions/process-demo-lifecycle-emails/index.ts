import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type EmailType = "demo_revealed" | "demo_conversion_24h";

type LifecycleJob = {
  id: string;
  dedupe_key: string;
  email_type: EmailType;
  event_id: string;
  user_id: string;
  attempts: number;
};

type DemoEvent = {
  id: string;
  name: string;
  password_hash: string;
  language: string | null;
};

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

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const getAllowedApiKeys = () => {
  const keys = new Set<string>();
  if (SUPABASE_ANON_KEY) keys.add(SUPABASE_ANON_KEY);
  try {
    const parsed = JSON.parse(SUPABASE_PUBLISHABLE_KEYS) as Record<string, string> | string[];
    if (Array.isArray(parsed)) parsed.forEach((key) => keys.add(key));
    else Object.values(parsed).forEach((key) => keys.add(key));
  } catch {
    if (SUPABASE_PUBLISHABLE_KEYS.startsWith("sb_publishable_")) {
      keys.add(SUPABASE_PUBLISHABLE_KEYS);
    }
  }
  return keys;
};

const getCopy = (language: string | null, eventName: string, eventUrl: string, emailType: EmailType) => {
  const lang = language === "en" || language === "it" ? language : "es";
  const copy = {
    es: {
      revealedSubject: `¡Ya puedes ver el contenido de ${eventName}!`,
      revealedTitle: "¡Tu contenido ya está revelado!",
      revealedBody: `Ya puedes entrar en ${eventName} y disfrutar de todas las fotos, vídeos y audios que se han generado.`,
      revealedButton: "Ver todo el contenido",
      conversionSubject: "¿Creamos tu evento de verdad?",
      conversionTitle: "Tu demo fue solo el principio",
      conversionBody: "Ya has probado Revelao. Ahora crea un evento para tu celebración y guarda todos sus recuerdos en un lugar único.",
      conversionButton: "Crear mi evento",
    },
    en: {
      revealedSubject: `Your ${eventName} content is ready!`,
      revealedTitle: "Your content has been revealed!",
      revealedBody: `You can now open ${eventName} and enjoy all the photos, videos and audio that were created.`,
      revealedButton: "See all content",
      conversionSubject: "Ready to create your real event?",
      conversionTitle: "Your demo was just the beginning",
      conversionBody: "You have tried Revelao. Now create an event for your celebration and keep every memory together in one special place.",
      conversionButton: "Create my event",
    },
    it: {
      revealedSubject: `I contenuti di ${eventName} sono pronti!`,
      revealedTitle: "I tuoi contenuti sono stati rivelati!",
      revealedBody: `Ora puoi entrare in ${eventName} e goderti tutte le foto, i video e gli audio creati.`,
      revealedButton: "Vedi tutti i contenuti",
      conversionSubject: "Creiamo il tuo vero evento?",
      conversionTitle: "La demo era solo l’inizio",
      conversionBody: "Hai provato Revelao. Ora crea un evento per la tua festa e conserva tutti i ricordi in un unico posto speciale.",
      conversionButton: "Crea il mio evento",
    },
  }[lang];

  if (emailType === "demo_revealed") {
    return {
      subject: copy.revealedSubject,
      title: copy.revealedTitle,
      body: copy.revealedBody,
      button: copy.revealedButton,
      url: eventUrl,
    };
  }
  return {
    subject: copy.conversionSubject,
    title: copy.conversionTitle,
    body: copy.conversionBody,
    button: copy.conversionButton,
    url: "https://www.revelao.cam",
  };
};

const sendEmail = async (to: string, event: DemoEvent, emailType: EmailType) => {
  const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
  const copy = getCopy(event.language, event.name, eventUrl, emailType);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: copy.subject,
      html: `<!doctype html>
        <html><body style="margin:0;background:#f7f3ee;font-family:Arial,sans-serif;color:#211a17;">
          <div style="max-width:560px;margin:0 auto;padding:32px 18px;">
            <div style="background:#fff;border-radius:18px;padding:32px;text-align:center;border:1px solid #eadfd7;">
              <img src="${LOGO_URL}" alt="Revelao" style="height:76px;width:auto;margin-bottom:20px;" />
              <h1 style="font-size:25px;margin:0 0 14px;">${escapeHtml(copy.title)}</h1>
              <p style="font-size:16px;line-height:1.6;color:#5f514a;margin:0 0 24px;">${escapeHtml(copy.body)}</p>
              <a href="${copy.url}" style="display:inline-block;background:#f06a5f;color:#fff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:700;">${escapeHtml(copy.button)}</a>
              <p style="font-size:12px;line-height:1.5;color:#8b7b72;margin:20px 0 0;word-break:break-all;"><a href="${copy.url}" style="color:#8b7b72;">${copy.url}</a></p>
            </div>
          </div>
        </body></html>`,
    }),
  });
  if (!response.ok) throw new Error(`RESEND_${response.status}:${await response.text()}`);
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = req.headers.get("apikey") ?? "";
  if (!apiKey || !getAllowedApiKeys().has(apiKey)) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !FROM_EMAIL) {
    return json({ error: "Missing server configuration" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const workerNow = new Date();
  const { data, error } = await admin.rpc("claim_demo_lifecycle_email_jobs", {
    worker_now: workerNow.toISOString(),
    stale_before: new Date(workerNow.getTime() - 15 * 60_000).toISOString(),
    batch_limit: 50,
  });
  if (error) return json({ error: error.message }, 500);

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const job of (data ?? []) as LifecycleJob[]) {
    try {
      const { data: event, error: eventError } = await admin.from("events")
        .select("id,name,password_hash,language")
        .eq("id", job.event_id)
        .single();
      if (eventError || !event) throw new Error("EVENT_NOT_FOUND");

      if (job.email_type === "demo_conversion_24h") {
        const { data: paidEvents, error: paidError } = await admin.from("events")
          .select("id")
          .eq("owner_id", job.user_id)
          .or("is_demo.eq.false,type.eq.paid")
          .limit(1);
        if (paidError) throw paidError;
        if ((paidEvents?.length ?? 0) > 0) {
          await admin.from("demo_lifecycle_email_jobs").update({
            status: "skipped", last_error: "User already has a paid event", updated_at: new Date().toISOString(),
          }).eq("id", job.id);
          results.push({ id: job.id, status: "skipped" });
          continue;
        }
      }

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(job.user_id);
      const email = userData.user?.email?.trim().toLowerCase();
      if (userError || !email) throw new Error("USER_EMAIL_NOT_FOUND");
      await sendEmail(email, event as DemoEvent, job.email_type);
      await admin.from("demo_lifecycle_email_jobs").update({
        status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      results.push({ id: job.id, status: "sent" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from("demo_lifecycle_email_jobs").update({
        status: "pending", last_error: message.slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      results.push({ id: job.id, status: "failed", error: message });
    }
  }

  return json({ processed: results.length, results });
});
