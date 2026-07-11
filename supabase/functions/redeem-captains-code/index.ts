import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "capitanes";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  if (code.length !== 16) return json({ error: "INVALID_CODE" }, 400);
  const admin = createClient(url, serviceKey);
  const { data: access } = await admin.from("captains_creation_codes").select("id, redeemed_at, expires_at").eq("code", code).maybeSingle();
  if (!access || access.redeemed_at || new Date(access.expires_at).getTime() <= Date.now()) return json({ error: "INVALID_CODE" }, 400);
  if (body.action === "validate") return json({ valid: true });
  if (body.action !== "create" || !body.event?.name || !Array.isArray(body.tables) || !Array.isArray(body.challenges)) return json({ error: "INVALID_PAYLOAD" }, 400);

  let slug = slugify(body.event.name);
  for (let suffix = 2;; suffix += 1) {
    const { data } = await admin.from("captains_events").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${slugify(body.event.name)}-${suffix}`;
  }
  const publicUrl = `/capitanes/${slug}`;
  const { data: event, error: eventError } = await admin.from("captains_events").insert({ ...body.event, slug, public_url: publicUrl, qr_url: publicUrl }).select("*").single();
  if (eventError) return json({ error: "CREATE_EVENT_FAILED" }, 500);
  const tableRows = body.tables.map((table: Record<string, unknown>, index: number) => ({ ...table, event_id: event.id, table_number: index + 1 }));
  const challengeRows = body.challenges.map((challenge: Record<string, unknown>, index: number) => ({ ...challenge, id: undefined, event_id: event.id, order_index: index + 1 }));
  const tablesResult = tableRows.length ? await admin.from("captains_tables").insert(tableRows) : { error: null };
  const challengesResult = challengeRows.length ? await admin.from("captains_event_challenges").insert(challengeRows) : { error: null };
  if (tablesResult.error || challengesResult.error) {
    await admin.from("captains_events").delete().eq("id", event.id);
    return json({ error: "CREATE_DETAILS_FAILED" }, 500);
  }
  const { data: redeemed, error: redeemError } = await admin.from("captains_creation_codes").update({ redeemed_at: new Date().toISOString(), event_id: event.id }).eq("id", access.id).is("redeemed_at", null).select("id").maybeSingle();
  if (redeemError || !redeemed) {
    await admin.from("captains_events").delete().eq("id", event.id);
    return json({ error: "CODE_ALREADY_USED" }, 409);
  }
  return json({ event });
});

