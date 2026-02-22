import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";
const LOGO_URL = Deno.env.get("LOGO_URL") ?? "";

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

const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const sha256 = async (text: string) => {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

const generateToken = (length = 48) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/=|\+|\//g, "");
};

const findAuthUserByEmail = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) => {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    console.error("request-password-reset listUsers error:", error.message);
    return null;
  }

  return (data?.users || []).find(
    (user) => user.email?.toLowerCase() === normalized,
  ) ?? null;
};

const sendResetEmail = async (to: string, resetUrl: string) => {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    console.error("request-password-reset missing email env", {
      hasResendKey: Boolean(RESEND_API_KEY),
      hasFromEmail: Boolean(FROM_EMAIL),
    });
    throw new Error("MISSING_EMAIL_ENV");
  }
  console.log("request-password-reset sending email", { to });
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      ${LOGO_URL ? `<div style="text-align:center;margin-bottom:24px;"><img src="${LOGO_URL}" alt="Revelao" style="width:240px; height:auto;" /></div>` : ""}
      <h2 style="margin: 0 0 8px; text-align:center;">Restablece tu contraseña</h2>
      <p style="margin: 0 0 16px; text-align:center;">
        Haz clic en el botón para crear una nueva contraseña.
      </p>
      <div style="text-align:center; margin: 0 0 24px;">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#f06a5f;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
          Cambiar contraseña
        </a>
      </div>
      <p style="font-size:12px;color:#666;text-align:center;">Este enlace caduca en 2 horas.</p>
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
      to,
      subject: "Restablece tu contraseña",
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend error:", response.status, errorText);
    throw new Error(`RESEND_FAILED:${response.status}`);
  }

  const responseBody = await response.text();
  console.log("request-password-reset resend ok", responseBody || "(empty)");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("request-password-reset missing supabase env", {
      hasUrl: Boolean(SUPABASE_URL),
      hasServiceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    });
    return json({ error: "Missing env" }, 500);
  }

  try {
    const { email } = (await req.json()) as { email?: string };
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!isEmail(cleanEmail)) {
      console.warn("request-password-reset invalid email", { email });
      return json({ error: "INVALID_EMAIL" }, 400);
    }
    console.log("request-password-reset request", { email: cleanEmail });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authUser = await findAuthUserByEmail(supabaseAdmin, cleanEmail);
    let userId = authUser?.id ?? null;

    if (!userId) {
      console.log("request-password-reset auth user not found", { email: cleanEmail });

      console.log("request-password-reset creating auth user", {
        email: cleanEmail,
      });

      const tempPassword = generateToken(24);
      const { data: createdUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: tempPassword,
          email_confirm: true,
        });

      if (createUserError || !createdUser?.user) {
        const message = createUserError?.message ?? "unknown_error";
        console.error("request-password-reset create auth user error:", message);

        if (message.toLowerCase().includes("already been registered")) {
          const fallbackUser = await findAuthUserByEmail(
            supabaseAdmin,
            cleanEmail,
          );

          if (!fallbackUser?.id) {
            console.warn("request-password-reset fallback user not found", {
              email: cleanEmail,
            });
            // Avoid user enumeration
            return json({ ok: true });
          }

          userId = fallbackUser.id;
        } else {
          // Avoid user enumeration
          return json({ ok: true });
        }
      }

      if (!userId && createdUser?.user?.id) {
        console.log("request-password-reset auth user created", {
          userId: createdUser.user.id,
        });

        userId = createdUser.user.id;
      }
    }

    const rawToken = generateToken(32);
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin.from("password_resets").insert({
      user_id: userId,
      email: cleanEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    console.log("request-password-reset token stored", {
      userId,
      expiresAt,
    });

    const resetUrl = `${APP_ORIGIN}/reset-password?token=${rawToken}`;
    await sendResetEmail(cleanEmail, resetUrl);

    return json({ ok: true });
  } catch (error) {
    console.error("request-password-reset error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
