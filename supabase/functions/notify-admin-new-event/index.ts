const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const ADMIN_EMAIL = "revelao.cam@gmail.com";
const DEFAULT_LOGO = "https://acceso.revelao.cam/LogoTransparent.png";
const DEFAULT_APP_ORIGIN = "https://acceso.revelao.cam";

function inferType(event: any, planLabel?: string): string {
  if (planLabel && typeof planLabel === "string" && planLabel.trim()) {
    return planLabel.trim();
  }
  const plan = (event?.plan_id ?? "").toString().toLowerCase();
  const type = (event?.type ?? "").toString().toLowerCase();
  const isDemo = event?.is_demo === true;
  if (isDemo || plan === "demo" || type === "demo") return "Demo";
  if (plan === "small") return "Start";
  if (plan === "medium" || plan === "large") return "Plus";
  if (plan === "xxl") return "Pro";
  if (plan === "custom") return "Personalizado";
  const mp = event?.max_photos;
  if (mp === 10) return "Demo";
  if (mp === 50 || mp === 200) return "Start";
  if (mp === 300 || mp === 1200) return "Plus";
  if (mp === 500 || mp === 1000 || mp == null) return "Pro";
  return "Evento";
}

function buildHtml(opts: {
  logoUrl: string;
  eventName: string;
  eventType: string;
  panelUrl: string;
}) {
  const { logoUrl, eventName, eventType, panelUrl } = opts;
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f6f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#3d2b1f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffaf3;border-radius:16px;padding:32px;border:1px solid #e9ddc9;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="${logoUrl}" alt="Revelao" style="max-width:160px;height:auto;display:block;" />
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:16px;line-height:1.5;padding-bottom:16px;">
                Se ha creado un nuevo evento en Revelao.
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:22px;font-weight:700;padding:8px 0;">
                ${eventName}
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:14px;color:#7a5a3f;padding-bottom:24px;">
                Tipo: <strong>${eventType}</strong>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:8px;">
                <a href="${panelUrl}" style="display:inline-block;background:#c97b3c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:15px;">
                  Ver en panel administrativo
                </a>
              </td>
            </tr>
          </table>
          <div style="font-size:12px;color:#a08a72;margin-top:16px;">Revelao</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escape(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL");
  const LOGO_URL = Deno.env.get("LOGO_URL") || DEFAULT_LOGO;
  const APP_ORIGIN = (Deno.env.get("APP_ORIGIN") || DEFAULT_APP_ORIGIN).replace(/\/+$/, "");

  if (!RESEND_API_KEY || !FROM_EMAIL) {
    return new Response(
      JSON.stringify({ error: "Missing RESEND_API_KEY or FROM_EMAIL" }),
      { status: 500, headers: jsonHeaders },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const event = body?.event;
  if (!event?.id || !event?.name) {
    return new Response(
      JSON.stringify({ error: "Missing event.id or event.name" }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const eventType = inferType(event, body?.planLabel);
  const eventName = String(event.name);
  const panelPath = typeof body?.panelPath === "string" && body.panelPath.startsWith("/")
    ? body.panelPath
    : `/event-form/${event.id}`;
  const panelUrl = `${APP_ORIGIN}${panelPath}`;

  const html = buildHtml({
    logoUrl: LOGO_URL,
    eventName: escape(eventName),
    eventType: escape(eventType),
    panelUrl,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: `Nuevo evento creado: ${eventName}`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error", res.status, text);
      return new Response(
        JSON.stringify({ error: "Resend send failed", details: text }),
        { status: 500, headers: jsonHeaders },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error("notify-admin-new-event error", err);
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(err) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
