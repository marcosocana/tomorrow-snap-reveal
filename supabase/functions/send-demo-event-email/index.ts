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
  name: string;
  email: string;
  phone: string;
};

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

  const { event, contactInfo, qrUrl } = (await req.json()) as {
    event?: DemoEvent;
    contactInfo?: ContactInfo;
    qrUrl?: string | null;
  };

  if (!event || !contactInfo?.email) {
    return json({ error: "Missing event or contact email" }, 400);
  }

  const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
  const adminUrl = "https://acceso.revelao.cam";
  const planUrl = "https://www.revelao.cam";
  const eventTz = event.timezone || "Europe/Madrid";
  const resolvedQrUrl =
    qrUrl ||
    `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
      eventUrl
    )}`;

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("es-ES", {
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

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5; background: #ffffff;">
      <div style="text-align: center; padding: 8px 0 16px;">
        <img src="${LOGO_URL}" alt="Revelao" style="height: 48px; width: auto; display: inline-block;" />
      </div>
      <h2>Tu evento de prueba está listo</h2>
      <p><strong>${event.name}</strong></p>
      <p><strong>Resumen del evento</strong></p>
      <div style="margin: 12px 0 20px; padding: 16px; background: #f5f5f5; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 12px;">
          <img src="${resolvedQrUrl}" alt="QR del evento" style="width: 180px; height: 180px; display: inline-block;" />
          <p style="margin: 8px 0 0; font-size: 12px; color: #666;">Escanea para acceder al evento</p>
        </div>
        <ul style="margin: 0; padding-left: 18px;">
          <li>Inicio de subida: ${formatDate(event.upload_start_time)}</li>
          <li>Fin de subida: ${formatDate(event.upload_end_time)}</li>
          <li>Revelado: ${formatDate(event.reveal_time)}</li>
          <li>Máximo de fotos: ${event.max_photos}</li>
          <li>Zona horaria: ${eventTz}</li>
        </ul>
      </div>
      <p>URL del evento: <a href="${eventUrl}">${eventUrl}</a></p>
      <p>Acceso de administrador: <a href="${adminUrl}">${adminUrl}</a></p>
      <p>Contraseña de administrador: <strong>${event.admin_password}</strong></p>
      <hr />
      <p><strong>Evento de prueba</strong></p>
      <p>
        Para contratar un evento real, visita <a href="${planUrl}">${planUrl}</a>
        y elige el plan que mejor se ajuste.
      </p>
    </div>
  `;

  const payload = {
    from: FROM_EMAIL,
    to: contactInfo.email,
    subject: "Tu evento de prueba en Revelao",
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
