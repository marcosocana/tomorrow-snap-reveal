const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const DEFAULT_LOGO = "https://acceso.revelao.cam/LogoTransparent.png";
const DEFAULT_APP_ORIGIN = "https://acceso.revelao.cam";

const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const getQrImageUrl = (value: string, providedQrImageUrl?: unknown) => {
  const provided = String(providedQrImageUrl || "").trim();
  if (
    provided.startsWith("https://quickchart.io/qr?")
    || /\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)/i.test(provided)
  ) {
    return provided;
  }
  return `https://quickchart.io/qr?size=1024&margin=1&ecLevel=H&text=${encodeURIComponent(value)}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL");
  const LOGO_URL = Deno.env.get("LOGO_URL") || DEFAULT_LOGO;
  const APP_ORIGIN = (Deno.env.get("APP_ORIGIN") || DEFAULT_APP_ORIGIN).replace(/\/+$/, "");

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY or FROM_EMAIL" }), { status: 500, headers: jsonHeaders });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: jsonHeaders });
  }

  const event = body?.event;
  const contactInfo = body?.contactInfo;
  const to = String(contactInfo?.email || event?.contact_email || "").trim().toLowerCase();
  if (!event?.id || !event?.name || !to) {
    return new Response(JSON.stringify({ error: "Missing event or contact email" }), { status: 400, headers: jsonHeaders });
  }

  const publicUrl = String(body?.publicUrl || event?.public_url || `${APP_ORIGIN}/capitanes/${event?.slug || ""}`);
  const adminUrl = String(body?.adminUrl || `${APP_ORIGIN}/admin/capitanes/${event.id}`);
  const qrImageUrl = getQrImageUrl(publicUrl, body?.qrImageUrl || event?.qr_url);
  const tableCount = Number(body?.tableCount || 0);
  const challengeCount = Number(body?.challengeCount || 0);
  const contactName = String(contactInfo?.name || event?.contact_name || "").trim();

  const html = `<!doctype html>
  <html lang="es">
    <body style="margin:0;padding:0;background:#f7f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#151515;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:32px;border:1px solid #eadfd5;">
              <tr><td align="center" style="padding-bottom:24px;"><img src="${LOGO_URL}" alt="Revelao" style="max-width:160px;height:auto;display:block;" /></td></tr>
              <tr><td style="font-size:15px;line-height:1.55;color:#444;">${contactName ? `Hola ${escape(contactName)},` : "Hola,"}</td></tr>
              <tr><td style="padding-top:8px;font-size:22px;font-weight:800;">Tu juego de Capitanes está listo</td></tr>
              <tr><td style="padding-top:8px;font-size:18px;font-weight:700;">${escape(event.name)}</td></tr>
              <tr>
                <td style="padding-top:18px;">
                  <div style="background:#f6f6f6;border-radius:14px;padding:16px;line-height:1.65;">
                    <div><strong>Inicio:</strong> ${escape(formatDate(event.start_time))}</div>
                    <div><strong>Fin:</strong> ${escape(formatDate(event.end_time))}</div>
                    <div><strong>Capitanes/mesas:</strong> ${tableCount || "-"}</div>
	                    <div><strong>Retos:</strong> ${challengeCount || "-"}</div>
	                    <div><strong>Acceso público:</strong> <a href="${escape(publicUrl)}">${escape(publicUrl)}</a></div>
	                  </div>
	                </td>
	              </tr>
	              <tr>
	                <td style="padding-top:20px;">
	                  <div style="background:#fff7f5;border:1px solid #ffd6d0;border-radius:14px;padding:18px;text-align:center;">
	                    <div style="font-size:14px;font-weight:800;color:#151515;margin-bottom:8px;">Código QR del juego</div>
	                    <a href="${escape(publicUrl)}" style="display:inline-block;text-decoration:none;">
	                      <img src="${escape(qrImageUrl)}" alt="QR de acceso al juego de Capitanes" width="180" height="180" style="width:180px;height:180px;display:block;margin:0 auto;border:0;" />
	                    </a>
	                    <div style="font-size:12px;line-height:1.45;color:#666;margin-top:10px;">Escanéalo con el móvil para entrar directamente al juego.</div>
	                  </div>
	                </td>
	              </tr>
	              <tr>
	                <td style="padding-top:20px;">
	                  <a href="${escape(adminUrl)}" style="display:inline-block;background:#151515;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">
                    Editar mi juego
                  </a>
                </td>
              </tr>
              <tr><td style="padding-top:16px;font-size:13px;color:#666;line-height:1.5;">Puedes entrar al panel para revisar nombres, capitanes, retos y contenido del evento.</td></tr>
            </table>
            <div style="font-size:12px;color:#a08a72;margin-top:16px;">Revelao</div>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: `Tu juego de Capitanes está listo: ${event.name}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("send-captains-event-email resend error", res.status, text);
    return new Response(JSON.stringify({ error: "Resend send failed", details: text }), { status: 500, headers: jsonHeaders });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders });
});
