import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type DemoEvent = {
  id?: string;
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
  Deno.env.get("LOGO_URL") ?? "https://acceso.revelao.cam/LogoTransparent.png";

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

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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

  const { event, contactInfo, qrUrl, eventType, planLabel, lang, publicUrl } = (await req.json()) as {
    event?: DemoEvent;
    contactInfo?: ContactInfo;
    qrUrl?: string | null;
    eventType?: "demo" | "paid" | "capsule" | "photostrip";
    planLabel?: string | null;
    lang?: EmailLang;
    publicUrl?: string | null;
  };

  if (!event || !contactInfo?.email) {
    return json({ error: "Missing event or contact email" }, 400);
  }

  const emailLang: EmailLang = lang === "en" || lang === "it" ? lang : "es";
  const pathPrefix = emailLang === "es" ? "" : `/${emailLang}`;
  const eventUrl = publicUrl?.trim() || `https://acceso.revelao.cam/events/${event.password_hash}`;
  const credentialEmail = contactInfo.email.trim().toLowerCase();
  const isPhotostrip = eventType === "photostrip";
  const editPath = isPhotostrip && event.id ? `/admin/photostrip/${event.id}/edit` : `${pathPrefix}/event-management`;
  const adminUrl = `https://acceso.revelao.cam${pathPrefix}/admin-login?email=${encodeURIComponent(credentialEmail)}&redirect=${encodeURIComponent(editPath)}`;
  const planUrl = "https://www.revelao.cam";
  const eventTz = event.timezone || "Europe/Madrid";
  const resolvedQrUrl =
    qrUrl ||
    `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
      eventUrl
    )}`;
  const logoSrc = LOGO_URL;

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

  const isCapsule = eventType === "capsule";
  const isDemo = eventType !== "paid" && !isCapsule;
  const t = {
    es: {
      subjectDemo: "Tu evento de prueba en Revelao",
      subjectPaid: "Tu evento en Revelao",
      subjectCapsule: "Tu cápsula del tiempo en Revelao",
      subjectPhotostrip: "Tu Photostrip demo está listo",
      introDemo: "Tu evento de prueba está listo",
      introPaid: "Tu evento está listo",
      introCapsule: "Tu cápsula del tiempo está lista",
      introPhotostrip: "Tu Photostrip demo está listo",
      howTitle: "Cómo funciona",
      howStep1: "Comparte el QR con tus invitados para que puedan acceder al evento.",
      howStep2: "Tus invitados suben fotos durante el periodo de subida.",
      howStep3: "En la fecha de Revelado, todas las fotos aparecen juntas.",
      capsuleStep1: "Comparte el QR con tus invitados durante la celebración.",
      capsuleStep2: "Cada invitado indica su nombre y graba un mensaje en vídeo.",
      capsuleStep3: "Los vídeos quedan guardados dentro de vuestra cápsula.",
      photostripStep1: "Comparte el QR para que los invitados entren desde su móvil.",
      photostripStep2: "Cada participación crea una tira automática de cuatro fotografías.",
      photostripStep3: "Pueden descargar su tira y ver las fotos de los demás en la galería común.",
      summary: "Fechas del evento",
      qrTitle: "Información de tu evento",
      qrLabel: "Código QR",
      qrHint: "Escanea con tu móvil para acceder al evento",
      qrUrlHint: "También puedes acceder con este enlace:",
      uploadStart: "Inicio de subida",
      uploadEnd: "Fin de subida",
      reveal: "Revelado",
      maxPhotos: "Fotografías incluidas",
      timezone: "Zona horaria",
      manageTitle: "Gestiona tu evento",
      manageText:
        "Para poder editar todos los detalles de tu evento, puedes acceder a {adminUrl} o haciendo click en el siguiente botón.",
      manageButton: "Gestionar mi evento",
      credentialsTitle: "Datos para gestionar tu evento",
      userLabel: "Usuario",
      passwordLabel: "Contraseña",
      credentialsHint: "Guarda estos datos. Los necesitarás para entrar en la gestión del evento.",
      demoNote: "Gracias por contar con Revelao.",
      paidTitle: "Evento de pago",
      paidText: "Gracias por contar con Revelao.",
      plan: "Plan",
    },
    en: {
      subjectDemo: "Your Revelao demo event",
      subjectPaid: "Your Revelao event",
      subjectCapsule: "Your Revelao time capsule",
      subjectPhotostrip: "Your Photostrip demo is ready",
      introDemo: "Your demo event is ready",
      introPaid: "Your event is ready",
      introCapsule: "Your time capsule is ready",
      introPhotostrip: "Your Photostrip demo is ready",
      howTitle: "How it works",
      howStep1: "Share the QR with your guests so they can access the event.",
      howStep2: "Your guests upload photos during the upload period.",
      howStep3: "On the Reveal date, all photos appear together.",
      capsuleStep1: "Share the QR with your guests during the celebration.",
      capsuleStep2: "Each guest enters their name and records a video message.",
      capsuleStep3: "The videos are safely stored inside your time capsule.",
      photostripStep1: "Share the QR so guests can open it from their phone.",
      photostripStep2: "Each session automatically creates a four-photo strip.",
      photostripStep3: "Guests can download their strip and open the shared gallery.",
      summary: "Event dates",
      qrTitle: "Your event information",
      qrLabel: "QR code",
      qrHint: "Scan with your phone to access the event",
      qrUrlHint: "You can also access with this link:",
      uploadStart: "Upload start",
      uploadEnd: "Upload end",
      reveal: "Reveal",
      maxPhotos: "Photos included",
      timezone: "Time zone",
      manageTitle: "Manage your event",
      manageText:
        "To edit all the details of your event, you can access {adminUrl} or click the button below.",
      manageButton: "Manage my event",
      credentialsTitle: "Your event management credentials",
      userLabel: "User",
      passwordLabel: "Password",
      credentialsHint: "Save these details. You will need them to manage your event.",
      demoNote: "Thanks for choosing Revelao.",
      paidTitle: "Paid event",
      paidText: "Thanks for choosing Revelao.",
      plan: "Plan",
    },
    it: {
      subjectDemo: "Il tuo evento demo su Revelao",
      subjectPaid: "Il tuo evento su Revelao",
      subjectCapsule: "La tua capsula del tempo su Revelao",
      subjectPhotostrip: "La tua demo Photostrip è pronta",
      introDemo: "Il tuo evento demo è pronto",
      introPaid: "Il tuo evento è pronto",
      introCapsule: "La tua capsula del tempo è pronta",
      introPhotostrip: "La tua demo Photostrip è pronta",
      howTitle: "Come funziona",
      howStep1: "Condividi il QR con gli invitati per accedere all’evento.",
      howStep2: "Gli invitati caricano foto durante il periodo di caricamento.",
      howStep3: "Alla data di Rivelazione, tutte le foto compaiono insieme.",
      capsuleStep1: "Condividi il QR con gli invitati durante la celebrazione.",
      capsuleStep2: "Ogni invitato inserisce il nome e registra un videomessaggio.",
      capsuleStep3: "I video restano custoditi nella vostra capsula del tempo.",
      photostripStep1: "Condividi il QR per far accedere gli invitati dal telefono.",
      photostripStep2: "Ogni sessione crea automaticamente una striscia di quattro foto.",
      photostripStep3: "Gli invitati possono scaricarla e aprire la galleria condivisa.",
      summary: "Date dell’evento",
      qrTitle: "Informazioni sul tuo evento",
      qrLabel: "Codice QR",
      qrHint: "Scansiona con il telefono per accedere all’evento",
      qrUrlHint: "Puoi accedere anche con questo link:",
      uploadStart: "Inizio caricamento",
      uploadEnd: "Fine caricamento",
      reveal: "Rivelazione",
      maxPhotos: "Foto incluse",
      timezone: "Fuso orario",
      manageTitle: "Gestisci il tuo evento",
      manageText:
        "Per modificare tutti i dettagli del tuo evento, puoi accedere a {adminUrl} oppure fare clic sul pulsante qui sotto.",
      manageButton: "Gestisci il mio evento",
      credentialsTitle: "Credenziali per gestire il tuo evento",
      userLabel: "Utente",
      passwordLabel: "Password",
      credentialsHint: "Conserva questi dati. Ti serviranno per gestire l’evento.",
      demoNote: "Grazie per aver scelto Revelao.",
      paidTitle: "Evento a pagamento",
      paidText: "Grazie per aver scelto Revelao.",
      plan: "Piano",
    },
  }[emailLang];

  const howSteps = isPhotostrip
    ? [t.photostripStep1, t.photostripStep2, t.photostripStep3]
    : isCapsule
    ? [t.capsuleStep1, t.capsuleStep2, t.capsuleStep3]
    : [t.howStep1, t.howStep2, t.howStep3];

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6; background: #ffffff;">
      <div style="text-align: center; padding: 8px 0 16px;">
        <img src="${logoSrc}" alt="Revelao" style="height: 96px; width: auto; display: inline-block;" />
      </div>
      <p style="font-size: 13px; margin: 0 0 4px;">${isPhotostrip ? t.introPhotostrip : isCapsule ? t.introCapsule : isDemo ? t.introDemo : t.introPaid}</p>
      <p style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">${event.name}</p>
      <p style="font-weight: 700; margin: 0 0 8px;">${t.howTitle}</p>
      <ul style="margin: 0 0 16px; padding-left: 20px; color: #444;">
        ${howSteps.map((step) => `<li style="margin-bottom: 6px;">${step}</li>`).join("")}
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
        ${isCapsule || isPhotostrip ? "" : `<p style="margin: 6px 0 0;">${t.reveal}: ${formatDate(event.reveal_time)}</p>`}
        ${isCapsule || isPhotostrip ? "" : `<p style="margin: 6px 0 0;">${t.maxPhotos}: ${event.max_photos}</p>`}
        <p style="margin: 6px 0 0;">${t.timezone}: ${eventTz}</p>
      </div>
      <div style="margin: 16px 0 20px; padding: 16px; background: #fef9c3; border: 1px solid #fde68a; border-radius: 12px;">
        ${
          isDemo || isCapsule
            ? `<div style="margin: 0 0 16px; padding: 16px; background: #ffffff; border: 2px solid #f06a5f; border-radius: 10px;">
                <p style="font-size: 16px; font-weight: 700; margin: 0 0 12px;">${t.credentialsTitle}</p>
                <p style="margin: 6px 0;"><strong>${t.userLabel}:</strong> <span style="font-family: monospace;">${escapeHtml(credentialEmail)}</span></p>
                <p style="margin: 6px 0;"><strong>${t.passwordLabel}:</strong> <span style="font-family: monospace; font-size: 18px; font-weight: 800; letter-spacing: 2px;">${escapeHtml(event.admin_password)}</span></p>
                <p style="font-size: 12px; color: #666; margin: 10px 0 0;">${t.credentialsHint}</p>
              </div>`
            : ""
        }
        <p style="margin: 0 0 10px; font-size: 13px; color: #333;">
          ${t.manageText.replace("{adminUrl}", `<a href="${adminUrl}">${adminUrl}</a>`)}
        </p>
        <div style="margin: 0 0 12px;">
          <a href="${adminUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
            ${t.manageButton}
          </a>
        </div>
        ${
          isDemo
            ? `<p style="margin: 0;">${t.demoNote.replace("{price}", "36€")}</p>`
            : isCapsule
              ? `<p style="margin: 0;">${t.paidText}</p>`
              : `<p style="margin: 0;"><strong>${t.paidTitle}</strong> ${t.paidText}</p>`
        }
      </div>
      <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
      
    </div>
  `;

  const payload = {
    from: FROM_EMAIL,
    to: contactInfo.email,
    subject: isPhotostrip ? t.subjectPhotostrip : isCapsule ? t.subjectCapsule : isDemo ? t.subjectDemo : t.subjectPaid,
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
