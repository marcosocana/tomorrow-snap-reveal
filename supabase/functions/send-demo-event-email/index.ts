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
      howTitle: "Cómo funciona",
      howStep1: "Comparte el QR con tus invitados para que puedan acceder al evento.",
      howStep2: "Tus invitados suben fotos durante el periodo de subida.",
      howStep3: "En la fecha de Revelado, todas las fotos aparecen juntas.",
      summary: "Fechas del evento",
      qrTitle: "Código QR del evento",
      qrLabel: "QR Code",
      qrHint: "Escanea con tu móvil para acceder al evento",
      qrUrlHint: "También puedes acceder con este enlace:",
      uploadStart: "Inicio de subida",
      uploadEnd: "Fin de subida",
      reveal: "Revelado",
      maxPhotos: "Fotografías incluidas",
      timezone: "Zona horaria",
      manageTitle: "Gestiona tu evento",
      manageButton: "Gestionar mi evento",
      demoNote:
        "Recuerda que este es un evento de prueba con un máximo de 10 fotos. Si quieres crear un evento real, puedes contratar un plan de pago desde {price}. Hazlo fácilmente desde el botón “Gestionar mi evento”.",
      paidTitle: "Evento de pago",
      paidText: "Gracias por confiar en Revelao. Si necesitas ayuda, responde a este email.",
      plan: "Plan",
    },
    en: {
      subjectDemo: "Your Revelao demo event",
      subjectPaid: "Your Revelao event",
      introDemo: "Your demo event is ready",
      introPaid: "Your event is ready",
      howTitle: "How it works",
      howStep1: "Share the QR with your guests so they can access the event.",
      howStep2: "Your guests upload photos during the upload period.",
      howStep3: "On the Reveal date, all photos appear together.",
      summary: "Event dates",
      qrTitle: "Event QR code",
      qrLabel: "QR Code",
      qrHint: "Scan with your phone to access the event",
      qrUrlHint: "You can also access with this link:",
      uploadStart: "Upload start",
      uploadEnd: "Upload end",
      reveal: "Reveal",
      maxPhotos: "Photos included",
      timezone: "Time zone",
      manageTitle: "Manage your event",
      manageButton: "Manage my event",
      demoNote:
        "Remember this is a demo event with a maximum of 10 photos. If you want to create a real event, you can purchase a paid plan from {price}. You can do it easily from the “Manage my event” button.",
      paidTitle: "Paid event",
      paidText: "Thanks for choosing Revelao. If you need help, reply to this email.",
      plan: "Plan",
    },
    it: {
      subjectDemo: "Il tuo evento demo su Revelao",
      subjectPaid: "Il tuo evento su Revelao",
      introDemo: "Il tuo evento demo è pronto",
      introPaid: "Il tuo evento è pronto",
      howTitle: "Come funziona",
      howStep1: "Condividi il QR con gli invitati per accedere all’evento.",
      howStep2: "Gli invitati caricano foto durante il periodo di caricamento.",
      howStep3: "Alla data di Rivelazione, tutte le foto compaiono insieme.",
      summary: "Date dell’evento",
      qrTitle: "Codice QR dell’evento",
      qrLabel: "QR Code",
      qrHint: "Scansiona con il telefono per accedere all’evento",
      qrUrlHint: "Puoi accedere anche con questo link:",
      uploadStart: "Inizio caricamento",
      uploadEnd: "Fine caricamento",
      reveal: "Rivelazione",
      maxPhotos: "Foto incluse",
      timezone: "Fuso orario",
      manageTitle: "Gestisci il tuo evento",
      manageButton: "Gestisci il mio evento",
      demoNote:
        "Ricorda che questo è un evento demo con un massimo di 10 foto. Se vuoi creare un evento reale, puoi acquistare un piano a pagamento da {price}. Puoi farlo facilmente dal pulsante “Gestisci il mio evento”.",
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
      <p style="font-weight: 700; margin: 0 0 8px;">${t.howTitle}</p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #444;">
        <li style="margin-bottom: 6px;">${t.howStep1}</li>
        <li style="margin-bottom: 6px;">${t.howStep2}</li>
        <li style="margin-bottom: 6px;">${t.howStep3}</li>
      </ul>
      <p style="font-weight: 700; margin: 0 0 8px;">${t.qrTitle}</p>
      <div style="margin: 12px 0 20px; padding: 16px; background: #f5f5f5; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 12px;">
          <p style="font-size: 12px; color: #666; margin: 0 0 6px;">${t.qrLabel}</p>
          <img src="${resolvedQrUrl}" alt="QR del evento" style="width: 180px; height: 180px; display: inline-block;" />
          <p style="margin: 8px 0 0; font-size: 12px; color: #666;">${t.qrHint}</p>
          <p style="margin: 8px 0 0; font-size: 12px; color: #666;">
            ${t.qrUrlHint} <a href="${eventUrl}">${eventUrl}</a>
          </p>
        </div>
        ${planLabel ? `<p style="margin: 8px 0 0;">${t.plan}: ${planLabel}</p>` : ""}
        <p style="font-weight: 700; margin: 12px 0 6px;">${t.summary}</p>
        <p style="margin: 6px 0 0;">${t.uploadStart}: ${formatDate(event.upload_start_time)}</p>
        <p style="margin: 6px 0 0;">${t.uploadEnd}: ${formatDate(event.upload_end_time)}</p>
        <p style="margin: 6px 0 0;">${t.reveal}: ${formatDate(event.reveal_time)}</p>
        <p style="margin: 6px 0 0;">${t.maxPhotos}: ${event.max_photos}</p>
        <p style="margin: 6px 0 0;">${t.timezone}: ${eventTz}</p>
      </div>
      <p style="font-weight: 700; margin: 0 0 8px;">${t.manageTitle}</p>
      <div style="margin: 0 0 16px;">
        <a href="${adminUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
          ${t.manageButton}
        </a>
      </div>
      <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
      ${
        isDemo
          ? `<p>${t.demoNote.replace("{price}", "36€")}</p>`
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
