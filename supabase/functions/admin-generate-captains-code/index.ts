import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const adminEmail = "revelao.cam@gmail.com";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const makeCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "UNAUTHORIZED" }, 401);
  if ((user.email ?? "").toLowerCase() !== adminEmail) return json({ error: "FORBIDDEN" }, 403);

  const admin = createClient(url, serviceKey);
  const code = makeCode();
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error } = await admin.from("captains_creation_codes").insert({ code, created_by: user.id, expires_at: expiresAt });
  if (error) return json({ error: "DB_ERROR" }, 500);
  return json({ code, expiresAt });
});

