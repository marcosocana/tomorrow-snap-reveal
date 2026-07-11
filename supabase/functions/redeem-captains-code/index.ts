import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "capitanes";
const pick = (source: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  if (code.length !== 16) return json({ error: "INVALID_CODE" }, 400);
  const admin = createClient(url, serviceKey);
  const { data: access } = await admin.from("captains_creation_codes").select("id, redeemed_at, expires_at, event_id").eq("code", code).maybeSingle();
  if (!access || new Date(access.expires_at).getTime() <= Date.now()) return json({ error: "INVALID_CODE" }, 400);
  if (access.redeemed_at && access.event_id) {
    const { data: existingEvent } = await admin.from("captains_events").select("id, slug").eq("id", access.event_id).maybeSingle();
    if (!existingEvent) return json({ error: "EVENT_NOT_FOUND" }, 404);
    return json({ valid: true, mode: "existing", event: existingEvent });
  }
  if (access.redeemed_at) return json({ error: "INVALID_CODE" }, 400);
  if (body.action === "validate") return json({ valid: true, mode: "create" });
  if (body.action !== "create" || !body.event?.name || !Array.isArray(body.tables) || !Array.isArray(body.challenges)) return json({ error: "INVALID_PAYLOAD" }, 400);

  let slug = slugify(body.event.name);
  for (let suffix = 2;; suffix += 1) {
    const { data } = await admin.from("captains_events").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${slugify(body.event.name)}-${suffix}`;
  }
  const publicUrl = `/capitanes/${slug}`;
  const eventBase = pick(body.event, ["name", "description", "start_time", "end_time", "scoring_mode", "status", "show_live_gallery_after_completion"]);
  const eventOptional = pick(body.event, ["theme_style", "primary_color", "secondary_color", "background_image_url", "contact_name", "contact_email", "contact_phone"]);
  let eventResult = await admin.from("captains_events").insert({ ...eventBase, ...eventOptional, slug, public_url: publicUrl, qr_url: publicUrl }).select("*").single();
  if (eventResult.error && Object.keys(eventOptional).some((key) => eventResult.error.message.includes(key))) {
    eventResult = await admin.from("captains_events").insert({ ...eventBase, slug, public_url: publicUrl, qr_url: publicUrl }).select("*").single();
  }
  const { data: event, error: eventError } = eventResult;
  if (eventError || !event) {
    console.error("redeem-captains-code create event:", eventError);
    return json({ error: "CREATE_EVENT_FAILED", detail: eventError?.message }, 500);
  }
  const tableRows = body.tables.map((table: Record<string, unknown>, index: number) => ({
    ...pick(table, ["table_name", "captain_name", "active_captain_name", "captain_photo_url", "captain_sprite", "captain_sprite_config"]),
    table_name: String(table.table_name || `Mesa ${index + 1}`).trim(),
    captain_name: String(table.captain_name || "").trim() || null,
    active_captain_name: String(table.captain_name || "").trim() || null,
    captain_photo_url: String(table.captain_photo_url || "").trim() || null,
    event_id: event.id,
    table_number: index + 1,
  }));
  const challengeRows = body.challenges.map((challenge: Record<string, unknown>, index: number) => ({
    ...pick(challenge, ["catalog_challenge_id", "title", "description", "evidence_type", "points", "category", "difficulty", "has_time_limit", "time_limit_seconds", "question_options", "question_correct_option", "is_required"]),
    catalog_challenge_id: isUuid(challenge.catalog_challenge_id) ? challenge.catalog_challenge_id : null,
    event_id: event.id,
    order_index: index + 1,
  }));
  let tablesResult = tableRows.length ? await admin.from("captains_tables").insert(tableRows).select("id") : { data: [], error: null };
  if (tablesResult.error && ["captain_photo_url", "captain_sprite", "captain_sprite_config"].some((key) => tablesResult.error!.message.includes(key))) {
    const fallbackRows = tableRows.map(({ captain_photo_url: _photo, captain_sprite: _sprite, captain_sprite_config: _config, ...row }) => row);
    tablesResult = await admin.from("captains_tables").insert(fallbackRows).select("id");
  }
  let challengesResult = challengeRows.length ? await admin.from("captains_event_challenges").insert(challengeRows).select("id") : { data: [], error: null };
  if (challengesResult.error && ["question_options", "question_correct_option"].some((key) => challengesResult.error!.message.includes(key))) {
    const fallbackRows = challengeRows.map(({ question_options: _options, question_correct_option: _correct, ...row }) => row);
    challengesResult = await admin.from("captains_event_challenges").insert(fallbackRows).select("id");
  }
  if (tablesResult.error || challengesResult.error) {
    console.error("redeem-captains-code create details:", { tables: tablesResult.error, challenges: challengesResult.error });
    await admin.from("captains_events").delete().eq("id", event.id);
    return json({ error: "CREATE_DETAILS_FAILED", detail: tablesResult.error?.message || challengesResult.error?.message }, 500);
  }
  const tableChallenges = (tablesResult.data || []).flatMap((table: { id: string }) =>
    (challengesResult.data || []).map((challenge: { id: string }, index: number) => ({
      event_id: event.id,
      table_id: table.id,
      challenge_id: challenge.id,
      randomized_order_index: index + 1,
      status: "pending",
    })),
  );
  if (tableChallenges.length) {
    const { error: assignmentError } = await admin.from("captains_table_challenges").insert(tableChallenges);
    if (assignmentError) {
      console.error("redeem-captains-code assign challenges:", assignmentError);
      await admin.from("captains_events").delete().eq("id", event.id);
      return json({ error: "ASSIGN_CHALLENGES_FAILED", detail: assignmentError.message }, 500);
    }
  }
  const { data: redeemed, error: redeemError } = await admin.from("captains_creation_codes").update({ redeemed_at: new Date().toISOString(), event_id: event.id }).eq("id", access.id).is("redeemed_at", null).select("id").maybeSingle();
  if (redeemError || !redeemed) {
    await admin.from("captains_events").delete().eq("id", event.id);
    return json({ error: "CODE_ALREADY_USED" }, 409);
  }
  return json({ event });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("redeem-captains-code unexpected error:", error);
    return json({ error: "UNEXPECTED_ERROR", detail }, 500);
  }
});
