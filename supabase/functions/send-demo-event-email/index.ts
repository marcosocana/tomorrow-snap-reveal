import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type DemoEvent = {
  name: string;
  password_hash: string;
  admin_password: string;
  reveal_time: string;
  upload_start_time: string;
  upload_end_time: string;
  timezone: string;
  max_photos: number;
};

type ContactInfo = {
  email: string;
  phone?: string;
};

type EmailLang = "es" | "en" | "it";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const LOGO_URL =
  Deno.env.get("LOGO_URL") ?? "https://www.revelao.cam/favicon.png";

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

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return json({ error: "Missing RESEND_API_KEY or FROM_EMAIL" }, 500);
  }

  const { event, contactInfo, qrUrl, eventType, planLabel, lang } = (await req.json()) as {
    event?: DemoEvent;
    contactInfo?: ContactInfo;
    qrUrl?: string | null;
    eventType?: "demo" | "paid";
    planLabel?: string | null;
    lang?: EmailLang;
  };

  if (!event || !contactInfo?.email) {
    return json({ error: "Missing event or contact email" }, 400);
  }

  const emailLang: EmailLang = lang === "en" || lang === "it" ? lang : "es";
  const pathPrefix = emailLang === "es" ? "" : `/${emailLang}`;
  const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
  const adminUrl = `https://acceso.revelao.cam${pathPrefix}/admin-login`;
  const planUrl = "https://www.revelao.cam";
  const eventTz = event.timezone || "Europe/Madrid";
  const resolvedQrUrl =
    qrUrl ||
    `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
      eventUrl
    )}`;

  const formatDate = (value: string) => {
    try {
      const locale =
        emailLang === "en"
          ? "en-US"
          : emailLang === "it"
            ? "it-IT"
            : "es-ES";
      return new Intl.DateTimeFormat(locale, {
        timeZone: eventTz,
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  const isDemo = eventType !== "paid";
  const t = {
    es: {
      subjectDemo: "Tu evento de prueba en Revelao",
      subjectPaid: "Tu evento en Revelao",
      introDemo: "Tu evento de prueba está listo",
      introPaid: "Tu evento está listo",
      summary: "Resumen del evento",
      qrTitle: "Código QR del evento",
      qrLabel: "QR Code",
      qrHint: "Escanea con tu móvil para acceder al evento",
      qrUrlHint: "También puedes acceder a través de la URL:",
      uploadStart: "Inicio de subida",
      uploadEnd: "Fin de subida",
      reveal: "Revelado",
      maxPhotos: "Máximo de fotos",
      timezone: "Zona horaria",
      adminHelp:
        "Si quieres ver las fotos antes del revelado o editar cualquier cosa, debes acceder al panel de administración.",
      adminAccess: "Acceso de administrador",
      adminPassword: "Contraseña de administrador",
      demoTitle: "Evento de prueba",
      demoText:
        "Para contratar un evento real, visita {planUrl} y elige el plan que mejor se ajuste.",
      paidTitle: "Evento de pago",
      paidText: "Gracias por confiar en Revelao. Si necesitas ayuda, responde a este email.",
      plan: "Plan",
    },
    en: {
      subjectDemo: "Your Revelao demo event",
      subjectPaid: "Your Revelao event",
      introDemo: "Your demo event is ready",
      introPaid: "Your event is ready",
      summary: "Event summary",
      qrTitle: "Event QR code",
      qrLabel: "QR Code",
      qrHint: "Scan with your phone to access the event",
      qrUrlHint: "You can also access via this URL:",
      uploadStart: "Upload start",
      uploadEnd: "Upload end",
      reveal: "Reveal",
      maxPhotos: "Max photos",
      timezone: "Time zone",
      adminHelp:
        "If you want to see photos before the reveal or edit anything, access the admin panel.",
      adminAccess: "Admin access",
      adminPassword: "Admin password",
      demoTitle: "Demo event",
      demoText:
        "To purchase a real event, visit {planUrl} and choose the plan that fits best.",
      paidTitle: "Paid event",
      paidText: "Thanks for choosing Revelao. If you need help, reply to this email.",
      plan: "Plan",
    },
    it: {
      subjectDemo: "Il tuo evento demo su Revelao",
      subjectPaid: "Il tuo evento su Revelao",
      introDemo: "Il tuo evento demo è pronto",
      introPaid: "Il tuo evento è pronto",
      summary: "Riepilogo evento",
      qrTitle: "Codice QR dell’evento",
      qrLabel: "QR Code",
      qrHint: "Scansiona con il telefono per accedere all’evento",
      qrUrlHint: "Puoi accedere anche tramite questo URL:",
      uploadStart: "Inizio caricamento",
      uploadEnd: "Fine caricamento",
      reveal: "Rivelazione",
      maxPhotos: "Numero massimo di foto",
      timezone: "Fuso orario",
      adminHelp:
        "Se vuoi vedere le foto prima della rivelazione o modificare qualcosa, accedi al pannello di amministrazione.",
      adminAccess: "Accesso amministratore",
      adminPassword: "Password amministratore",
      demoTitle: "Evento demo",
      demoText:
        "Per acquistare un evento reale, visita {planUrl} e scegli il piano più adatto.",
      paidTitle: "Evento a pagamento",
      paidText: "Grazie per aver scelto Revelao. Se hai bisogno di aiuto, rispondi a questa email.",
      plan: "Piano",
    },
  }[emailLang];

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6; background: #ffffff;">
      <div style="text-align: center; padding: 8px 0 16px;">
        <img src="${LOGO_URL}" alt="Revelao" style="height: 192px; width: auto; display: inline-block;" />
      </div>
      <p style="font-size: 13px; margin: 0 0 4px;">${isDemo ? t.introDemo : t.introPaid}</p>
      <p style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">${event.name}</p>
      <p style="font-weight: 700; margin: 0 0 8px;">${t.summary}</p>
      <div style="margin: 12px 0 20px; padding: 16px; background: #f5f5f5; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 12px;">
          <p style="font-weight: 700; margin: 0 0 6px;">${t.qrTitle}</p>
          <p style="font-size: 12px; color: #666; margin: 0 0 6px;">${t.qrLabel}</p>
          <img src="${resolvedQrUrl}" alt="QR del evento" style="width: 180px; height: 180px; display: inline-block;" />
          <p style="margin: 8px 0 0; font-size: 12px; color: #666;">${t.qrHint}</p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #666;">
            ${t.qrUrlHint} <a href="${eventUrl}">${eventUrl}</a>
          </p>
        </div>
        ${planLabel ? `<p style="margin: 8px 0 0;">${t.plan}: ${planLabel}</p>` : ""}
        <p style="margin: 8px 0 0;">${t.uploadStart}: ${formatDate(event.upload_start_time)}</p>
        <p style="margin: 8px 0 0;">${t.uploadEnd}: ${formatDate(event.upload_end_time)}</p>
        <p style="margin: 8px 0 0;">${t.reveal}: ${formatDate(event.reveal_time)}</p>
        <p style="margin: 8px 0 0;">${t.maxPhotos}: ${event.max_photos}</p>
        <p style="margin: 8px 0 0;">${t.timezone}: ${eventTz}</p>
      </div>
      <p style="margin: 0 0 12px;">${t.adminHelp}</p>
      <p style="margin: 0 0 6px;">${t.adminAccess}: <a href="${adminUrl}">${adminUrl}</a></p>
      <p style="margin: 0 0 6px;">${t.adminPassword}: <strong>${event.admin_password}</strong></p>
      <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
      ${
        isDemo
          ? `<p><strong>${t.demoTitle}</strong></p>
      <p>${t.demoText.replace("{planUrl}", `<a href="${planUrl}">${planUrl}</a>`)}</p>`
          : `<p><strong>${t.paidTitle}</strong></p>
      <p>${t.paidText}</p>`
      }
    </div>
  `;

  const payload = {
    from: FROM_EMAIL,
    to: contactInfo.email,
    subject: isDemo ? t.subjectDemo : t.subjectPaid,
    html,
  };

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    return json({ error: errorText }, 500);
  }

  return json({ success: true });
});
