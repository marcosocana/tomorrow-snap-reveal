import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_PUBLISHABLE_KEYS = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
const DEMO_SLUG = "demo-capitanes-v2";
const BUCKET = "captains-evidence";
const RETENTION_MS = 60 * 60 * 1000;
const BATCH_SIZE = 500;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const allowedApiKeys = () => {
  const keys = new Set<string>();
  if (SUPABASE_ANON_KEY) keys.add(SUPABASE_ANON_KEY);
  try {
    const parsed = JSON.parse(SUPABASE_PUBLISHABLE_KEYS) as Record<string, string> | string[];
    (Array.isArray(parsed) ? parsed : Object.values(parsed)).forEach((key) => keys.add(key));
  } catch {
    if (SUPABASE_PUBLISHABLE_KEYS.startsWith("sb_publishable_")) keys.add(SUPABASE_PUBLISHABLE_KEYS);
  }
  return keys;
};

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const apiKey = req.headers.get("apikey") ?? "";
  if (!apiKey || !allowedApiKeys().has(apiKey)) return json({ error: "Unauthorized" }, 401);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: "Missing server configuration" }, 500);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: event, error: eventError } = await admin
    .from("captains_events")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (eventError) return json({ error: eventError.message }, 500);
  if (!event) return json({ deletedObjects: 0, deletedEvidence: 0 });

  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  let deletedObjects = 0;
  while (true) {
    const { data: objects, error: objectsError } = await admin.rpc(
      "list_expired_captains_demo_storage_objects",
      { cutoff, batch_limit: BATCH_SIZE },
    );
    if (objectsError) return json({ error: objectsError.message }, 500);
    const paths = (objects ?? []).map((object) => object.name as string);
    if (!paths.length) break;
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
    if (removeError) return json({ error: removeError.message }, 500);
    deletedObjects += paths.length;
    if (paths.length < BATCH_SIZE) break;
  }

  const { data: evidence, error: evidenceError } = await admin
    .from("captains_evidence")
    .delete()
    .eq("event_id", event.id)
    .lt("created_at", cutoff)
    .select("id");
  if (evidenceError) return json({ error: evidenceError.message }, 500);

  return json({ cutoff, deletedObjects, deletedEvidence: evidence?.length ?? 0 });
});
