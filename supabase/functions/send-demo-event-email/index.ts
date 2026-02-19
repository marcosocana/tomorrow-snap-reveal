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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return json({ error: "Missing RESEND_API_KEY or FROM_EMAIL" }, 500);
  }

  const { event, contactInfo } = (await req.json()) as {
    event?: DemoEvent;
    contactInfo?: ContactInfo;
  };

  if (!event || !contactInfo?.email) {
    return json({ error: "Missing event or contact email" }, 400);
  }

  const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
  const adminUrl = "https://acceso.revelao.cam";
  const planUrl = "https://www.revelao.cam";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2>Tu evento de prueba está listo</h2>
      <p><strong>${event.name}</strong></p>
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
