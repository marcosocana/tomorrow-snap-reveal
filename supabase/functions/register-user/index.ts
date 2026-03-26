import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://acceso.revelao.cam";
const LOGO_URL = Deno.env.get("LOGO_URL") ?? "https://acceso.revelao.cam/demo-logo.png";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing Supabase env" }, 500);
  }

  try {
    const { email, password, phone, marketingOptIn } = (await req.json()) as {
      email?: string;
      password?: string;
      phone?: string | null;
      marketingOptIn?: boolean;
    };

    if (!email || !isEmail(email)) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: "WEAK_PASSWORD" }, 400);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Create user in Auth with email auto-confirmed
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      // User already exists
      if (
        authError.message?.toLowerCase().includes("already") ||
        authError.message?.toLowerCase().includes("exists") ||
        authError.message?.toLowerCase().includes("unique")
      ) {
        return json({ error: "USER_EXISTS" }, 409);
      }
      console.error("Auth createUser error:", authError);
      return json({ error: "AUTH_ERROR" }, 500);
    }

    const userId = authData.user?.id;
    if (!userId) {
      return json({ error: "AUTH_ERROR" }, 500);
    }

    // 2. Upsert user_profiles
    const { error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          phone: phone || null,
          marketing_opt_in: marketingOptIn ?? true,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("Profile upsert error:", profileError);
      // Non-fatal: user is created, profile can be updated later
    }

    // 3. Send welcome email via Resend
    if (RESEND_API_KEY && FROM_EMAIL) {
      const loginUrl = `${APP_ORIGIN}/admin-login`;
      const html = `
        <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6; background: #ffffff; max-width: 560px; margin: 0 auto;">
          <div style="text-align: center; padding: 8px 0 16px;">
            <img src="${LOGO_URL}" alt="Revelao" style="height: 96px; width: auto; display: inline-block;" />
          </div>
          <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 12px;">¡Bienvenido a Revelao!</h1>
          <p style="font-size: 14px; color: #444; margin: 0 0 16px;">
            Tu cuenta ha sido creada con éxito. Ya puedes iniciar sesión y empezar a crear tus eventos.
          </p>
          <div style="margin: 20px 0;">
            <a href="${loginUrl}" style="display:inline-block;padding:14px 24px;background:#111;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
              Iniciar sesión
            </a>
          </div>
          <p style="font-size: 12px; color: #999; margin: 24px 0 0;">
            Si no has creado esta cuenta, puedes ignorar este mensaje.
          </p>
          <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />
        </div>
      `;

      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: email,
            subject: "Registro confirmado — Revelao",
            html,
          }),
        });

        if (!resendRes.ok) {
          console.error("Resend error:", await resendRes.text());
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }
    }

    // 4. Sign in the new user to return a session
    const supabaseAnon = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: loginData, error: loginError } =
      await supabaseAnon.auth.signInWithPassword({ email, password });

    if (loginError || !loginData?.session) {
      // User created but auto-login failed — they can log in manually
      return json({ success: true, userId, session: null });
    }

    return json({ success: true, userId, session: loginData.session });
  } catch (error) {
    console.error("register-user error:", error);
    return json({ error: "UNKNOWN_ERROR" }, 500);
  }
});
