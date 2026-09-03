export type PurchaseEmailType = "revelao_purchase" | "captains_purchase";

export type PurchaseEmailJob = {
  id: string;
  stripe_session_id: string;
  email_type: PurchaseEmailType;
  recipient: string;
  payload: Record<string, unknown>;
  attempts: number;
};

type SendConfig = {
  resendApiKey: string;
  fromEmail: string;
  logoUrl: string;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const safeUrl = (value: unknown) => {
  const url = new URL(String(value));
  if (url.protocol !== "https:") throw new Error("INVALID_EMAIL_URL");
  return url.toString();
};

const renderEmail = (job: PurchaseEmailJob, logoUrl: string) => {
  const logo = logoUrl
    ? `<p style="text-align:center;"><img src="${escapeHtml(safeUrl(logoUrl))}" alt="Revelao" style="height:48px;" /></p>`
    : "";

  if (job.email_type === "captains_purchase") {
    const onboardingUrl = safeUrl(job.payload.onboardingUrl);
    const tableCount = Math.max(1, Math.floor(Number(job.payload.tableCount ?? 1)));
    const captainPack = job.payload.captainPack === true;
    const totalAmount = typeof job.payload.totalAmount === "number" ? job.payload.totalAmount : null;
    const currency = String(job.payload.currency || "eur").toUpperCase();
    const formattedTotal = totalAmount === null ? "" : new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
    }).format(totalAmount / 100);
    return {
      subject: "Tu enlace para crear Capitanes",
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
        ${logo}<h2 style="text-align:center;">Tu compra de Capitanes está lista</h2>
        <p style="text-align:center;color:#444;">Ya puedes crear tu juego de Capitanes. Inicia sesión con la misma cuenta utilizada para realizar la compra.</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:20px 0;">
          <p><strong>Mesas:</strong> ${tableCount}</p><p><strong>Pack Capitán:</strong> ${captainPack ? "Sí" : "No"}</p>
          ${formattedTotal ? `<p><strong>Total pagado:</strong> ${escapeHtml(formattedTotal)}</p>` : ""}
        </div>
        <p style="text-align:center;"><a href="${escapeHtml(onboardingUrl)}" style="display:inline-block;background:#f06a5f;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">Crear mi juego de Capitanes</a></p>
        <div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
          <p style="font-size:13px;color:#777;">Código de acceso</p><p style="font-size:22px;font-weight:800;letter-spacing:3px;">${escapeHtml(job.payload.creationCode)}</p>
        </div></div>`,
    };
  }

  const redeemUrl = safeUrl(job.payload.redeemUrl);
  return {
    subject: "Tu enlace para crear el evento",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
      ${logo}<h2 style="text-align:center;">Tu plan ${escapeHtml(job.payload.planLabel)} ya está listo</h2>
      <p style="text-align:center;"><a href="${escapeHtml(redeemUrl)}" style="display:inline-block;background:#f06a5f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Crear mi evento</a></p>
      <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-top:24px;text-align:center;">
        <p style="font-size:13px;color:#888;">Código de canje</p><p style="font-size:20px;font-weight:bold;letter-spacing:2px;">${escapeHtml(job.payload.redeemCode)}</p>
      </div></div>`,
  };
};

export const sendPurchaseEmail = async (job: PurchaseEmailJob, config: SendConfig) => {
  if (!config.resendApiKey || !config.fromEmail) throw new Error("MISSING_EMAIL_CONFIGURATION");
  const content = renderEmail(job, config.logoUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `stripe-${job.stripe_session_id}-${job.email_type}`,
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [job.recipient],
      subject: content.subject,
      html: content.html,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`RESEND_${response.status}:${JSON.stringify(body).slice(0, 700)}`);
  return typeof body?.id === "string" ? body.id : null;
};
