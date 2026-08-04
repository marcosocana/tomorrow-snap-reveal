import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getPlanById } from "../_shared/planConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";
const LOGO_URL = Deno.env.get("LOGO_URL") ?? "";
const ADMIN_EMAIL = "revelao.cam@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const generateRedeemToken = (length = 16) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
};

const isUserExistsError = (message: string) => {
  const normalized = message.toLowerCase();
  return normalized.includes("already been registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("email already") ||
    normalized.includes("already exists");
};

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) => {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = (data?.users || []).find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if ((data?.users || []).length < 1000) return null;
  }
  return null;
};

const sendGiftEmail = async ({
  recipientName,
  email,
  password,
  planLabel,
  redeemUrl,
  existingAccount,
}: {
  recipientName: string;
  email: string;
  password: string;
  planLabel: string;
  redeemUrl: string;
  existingAccount: boolean;
}) => {
  if (!RESEND_API_KEY || !FROM_EMAIL) throw new Error("MISSING_EMAIL_ENV");

  const safeName = escapeHtml(recipientName);
  const safeEmail = escapeHtml(email);
  const safePlan = escapeHtml(planLabel);
  const safeUrl = escapeHtml(redeemUrl);
  const credentials = existingAccount
    ? `<p style="margin:0;color:#555;">Tu cuenta ya existía, así que debes utilizar la contraseña que ya tenías. Si no la recuerdas, puedes recuperarla desde la pantalla de acceso.</p>`
    : `<div style="background:#f5f5f5;border-radius:12px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>Usuario:</strong> ${safeEmail}</p>
        <p style="margin:0;"><strong>Contraseña:</strong> ${escapeHtml(password)}</p>
      </div>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#151515;line-height:1.5;">
      ${LOGO_URL ? `<p style="text-align:center;"><img src="${escapeHtml(LOGO_URL)}" alt="Revelao" style="height:48px;" /></p>` : ""}
      <h2 style="text-align:center;margin-bottom:8px;">${safeName}, te han regalado Revelao</h2>
      <p style="text-align:center;color:#555;margin-top:0;">Tienes un plan ${safePlan} listo para crear tu evento.</p>
      ${credentials}
      <p style="text-align:center;margin:24px 0;">
        <a href="${safeUrl}" style="display:inline-block;background:#f06a5f;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:700;">
          Crear mi evento
        </a>
      </p>
      <p style="font-size:12px;color:#777;text-align:center;">Primero tendrás que acceder con tu usuario y contraseña. Después podrás configurar el evento y editarlo siempre desde acceso.revelao.cam.</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: `${recipientName}, te han regalado Revelao`,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`RESEND_FAILED:${response.status}:${await response.text()}`);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return json({ error: "MISSING_ENV" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);
  if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) return json({ error: "FORBIDDEN" }, 403);

  const payload = await req.json().catch(() => ({}));
  const recipientName = String(payload?.recipientName || "").trim().replace(/\s+/g, " ");
  const email = String(payload?.email || "").trim().toLowerCase();
  const password = String(payload?.password || "");
  const plan = getPlanById(String(payload?.planId || ""));
  const confirmExisting = payload?.confirmExisting === true;

  if (
    !recipientName || recipientName.length > 120 ||
    !isEmail(email) || email.length > 320 ||
    password.length < 8 || password.length > 128 ||
    !plan
  ) {
    return json({ error: "INVALID_PAYLOAD" }, 400);
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let existingUser = await findAuthUserByEmail(supabaseAdmin, email);
  if (existingUser && !confirmExisting) {
    return json({ requiresConfirmation: true, existingAccount: true });
  }

  let userId = existingUser?.id ?? null;
  let createdNewUser = false;
  let purchaseId: string | null = null;

  try {
    if (!userId) {
      const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: recipientName },
      });

      if (createUserError || !createdUser?.user?.id) {
        const message = createUserError?.message || "CREATE_USER_FAILED";
        if (isUserExistsError(message)) {
          existingUser = await findAuthUserByEmail(supabaseAdmin, email);
          if (existingUser && !confirmExisting) {
            return json({ requiresConfirmation: true, existingAccount: true });
          }
          userId = existingUser?.id ?? null;
        } else {
          throw new Error(message);
        }
      } else {
        userId = createdUser.user.id;
        createdNewUser = true;
      }
    }

    if (!userId) throw new Error("USER_NOT_FOUND");

    const redeemToken = generateRedeemToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        user_id: userId,
        user_email: email,
        stripe_session_id: null,
        plan_id: plan.id,
        status: "paid",
        redeem_token: redeemToken,
        redeem_token_expires_at: expiresAt,
        redeemed_at: null,
        gifted_at: new Date().toISOString(),
        gift_recipient_name: recipientName,
      })
      .select("id, redeem_token, redeem_token_expires_at")
      .single();

    if (purchaseError || !purchase) throw new Error(purchaseError?.message || "CREATE_GIFT_FAILED");
    purchaseId = purchase.id;

    const redeemUrl = `${APP_ORIGIN}/redeem/${purchase.redeem_token}`;
    await sendGiftEmail({
      recipientName,
      email,
      password,
      planLabel: plan.label,
      redeemUrl,
      existingAccount: !createdNewUser,
    });

    return json({
      ok: true,
      token: purchase.redeem_token,
      expiresAt: purchase.redeem_token_expires_at,
      existingAccount: !createdNewUser,
    });
  } catch (error) {
    console.error("admin-gift-revelao error:", error);
    if (purchaseId) await supabaseAdmin.from("purchases").delete().eq("id", purchaseId);
    if (createdNewUser && userId) await supabaseAdmin.auth.admin.deleteUser(userId);
    return json({ error: "GIFT_FAILED" }, 500);
  }
});
