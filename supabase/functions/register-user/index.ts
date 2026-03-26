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

const sendWelcomeEmail = async (to: string) => {
  if (!RESEND_API_KEY || !FROM_EMAIL) {
    throw new Error("MISSING_EMAIL_ENV");
  }

  const loginUrl = `${APP_ORIGIN}/admin-login?email=${encodeURIComponent(to)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      ${LOGO_URL ? `<div style="text-align:center;margin-bottom:24px;"><img src="${LOGO_URL}" alt="Revelao" style="width:240px; height:auto;" /></div>` : ""}
      <h2 style="margin: 0 0 8px; text-align:center;">Registro confirmado con exito</h2>
      <p style="margin: 0 0 16px; text-align:center;">
        Tu cuenta ya esta lista. Puedes entrar al area privada con tu usuario y contrasena.
      </p>
      <div style="text-align:center; margin: 0 0 24px;">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 18px;background:#f06a5f;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
          Entrar al area privada
        </a>
      </div>
      <p style="font-size:12px;color:#666;text-align:center;">Si no has solicitado este registro, puedes ignorar este correo.</p>
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
      subject: "Registro confirmado con exito",
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("register-user resend error:", response.status, errorText);
    throw new Error(`RESEND_FAILED:${response.status}`);
  }
};

// deno-lint-ignore no-explicit-any
const findAuthUserByEmail = async (supabaseAdmin: any, email: string) => {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw error;
  }

  return (data?.users || []).find(
    (user: any) => user.email?.toLowerCase() === normalized,
  ) ?? null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing env" }, 500);
  }

  try {
    const { email, password, phone, marketingConsent } = (await req.json()) as {
      email?: string;
      password?: string;
      phone?: string | null;
      marketingConsent?: boolean;
    };

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPassword = (password || "").trim();

    if (!isEmail(cleanEmail) || cleanPassword.length < 6) {
      return json({ error: "INVALID_PAYLOAD" }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const existingUser = await findAuthUserByEmail(supabaseAdmin, cleanEmail);
    if (existingUser?.id) {
      return json({ ok: false, error: "EMAIL_EXISTS" });
    }

    const { data: createdUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
      });

    if (createError || !createdUser?.user?.id) {
      console.error("register-user create auth user error:", createError);
      return json({ error: "CREATE_USER_FAILED" }, 500);
    }

    const userId = createdUser.user.id;
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        id: userId,
        phone: phone?.trim() || null,
        marketing_opt_in: marketingConsent === true,
      });

    if (profileError) {
      console.error("register-user profile error:", profileError);
      return json({ error: "PROFILE_SAVE_FAILED" }, 500);
    }

    await sendWelcomeEmail(cleanEmail);

    return json({ ok: true, userId });
  } catch (error) {
    console.error("register-user error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
