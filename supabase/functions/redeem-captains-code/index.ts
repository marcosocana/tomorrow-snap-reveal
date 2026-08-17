import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "capitanes";
const pick = (source: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const MAX_CHALLENGES = 25;
const CAPTAINS_PUBLIC_ORIGIN = "https://acceso.revelao.cam";
const getQrImageUrl = (publicUrl: string) =>
  `https://quickchart.io/qr?size=1024&margin=1&ecLevel=H&text=${encodeURIComponent(publicUrl)}`;
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const generateManagementPassword = (length = 10) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = new Uint8Array(length);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
};
const findAuthUserByEmail = async (admin: ReturnType<typeof createClient>, email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = (data?.users || []).find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if ((data?.users || []).length < 1000) break;
  }
  return null;
};
const sendOwnerSummaryEmail = async ({
  event,
  contactInfo,
  publicUrl,
  qrImageUrl,
  adminUrl,
  tableCount,
  challengeCount,
  credentials,
}: {
  event: Record<string, unknown>;
  contactInfo: { name: string; email: string; phone: string };
  publicUrl: string;
  qrImageUrl: string;
  adminUrl: string;
  tableCount: number;
  challengeCount: number;
  credentials: { email: string; password: string | null };
}) => {
  try {
    const response = await fetch(`${url}/functions/v1/send-captains-event-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ event, contactInfo, publicUrl, qrImageUrl, adminUrl, tableCount, challengeCount, credentials }),
    });
    if (!response.ok) console.error("redeem-captains-code summary email error:", await response.text());
    return response.ok;
  } catch (error) {
    console.error("redeem-captains-code summary email error:", error);
    return false;
  }
};
const resolveManagementAccount = async (
  admin: ReturnType<typeof createClient>,
  email: string,
  phone?: string | null,
) => {
  const existingUser = await findAuthUserByEmail(admin, email);
  let ownerId = existingUser?.id || null;
  let managementPassword = "";

  if (ownerId) {
    const { data: firstOwnedEvent, error: firstOwnedEventError } = await admin
      .from("events")
      .select("admin_password")
      .eq("owner_id", ownerId)
      .not("admin_password", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstOwnedEventError) throw firstOwnedEventError;

    const storedPassword = existingUser.user_metadata?.management_password;
    managementPassword = String(firstOwnedEvent?.admin_password || storedPassword || "").trim()
      || generateManagementPassword();

    const { error: updateUserError } = await admin.auth.admin.updateUserById(ownerId, {
      password: managementPassword,
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        management_password: managementPassword,
      },
    });
    if (updateUserError) throw updateUserError;
  } else {
    managementPassword = generateManagementPassword();
    const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password: managementPassword,
      email_confirm: true,
      user_metadata: { management_password: managementPassword },
    });
    if (createUserError || !createdUser?.user?.id) {
      throw createUserError || new Error("CREATE_USER_FAILED");
    }
    ownerId = createdUser.user.id;
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .upsert({ id: ownerId, phone: phone?.trim() || null }, { onConflict: "id" });
  if (profileError) throw profileError;

  return { ownerId, managementPassword };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim().toUpperCase();
  if (code.length !== 16) return json({ error: "INVALID_CODE" }, 400);
  const admin = createClient(url, serviceKey);
  const { data: access } = await admin.from("captains_creation_codes").select("id, redeemed_at, expires_at, event_id, max_tables, account_owner_id").eq("code", code).maybeSingle();
  if (!access || new Date(access.expires_at).getTime() <= Date.now()) return json({ error: "INVALID_CODE" }, 400);
  let authenticatedUserId: string | null = null;
  if (access.account_owner_id) {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ") || !anonKey) return json({ error: "LOGIN_REQUIRED" }, 401);
    const authClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "LOGIN_REQUIRED" }, 401);
    authenticatedUserId = userData.user.id;
    if (authenticatedUserId !== access.account_owner_id) return json({ error: "ACCOUNT_MISMATCH" }, 403);
  }
  if (access.redeemed_at && access.event_id) {
    const { data: existingEvent } = await admin.from("captains_events").select("*").eq("id", access.event_id).maybeSingle();
    if (!existingEvent) return json({ error: "EVENT_NOT_FOUND" }, 404);
    if (body.action === "validate") {
      const [{ data: tables }, { data: challenges }] = await Promise.all([
        admin.from("captains_tables").select("*").eq("event_id", access.event_id).order("table_number"),
        admin.from("captains_event_challenges").select("*").eq("event_id", access.event_id).order("order_index"),
      ]);
      return json({ valid: true, mode: "edit", event: existingEvent, tables: tables || [], challenges: challenges || [], maxTables: access.max_tables });
    }
    if (body.action === "update" && body.event?.name && Array.isArray(body.tables) && Array.isArray(body.challenges)) {
      if (body.tables.length < 1 || body.tables.length > access.max_tables) return json({ error: "TABLE_LIMIT_EXCEEDED", maxTables: access.max_tables }, 400);
      if (body.challenges.length < 1 || body.challenges.length > MAX_CHALLENGES) return json({ error: "CHALLENGE_LIMIT_EXCEEDED", maxChallenges: MAX_CHALLENGES }, 400);
      const eventChanges = {
        ...pick(body.event, ["name", "description", "start_time", "end_time", "contact_name", "contact_email", "contact_phone"]),
        scoring_mode: "automatic",
        status: "active",
        show_live_gallery_after_completion: true,
        theme_style: "pixel",
        primary_color: "#f06a5f",
        secondary_color: "#2f292d",
        background_image_url: null,
        updated_at: new Date().toISOString(),
      };
      const { data: updatedEvent, error: updateEventError } = await admin.from("captains_events").update(eventChanges).eq("id", access.event_id).select("*").single();
      if (updateEventError) return json({ error: "UPDATE_EVENT_FAILED", detail: updateEventError.message }, 500);

      const { data: oldTables } = await admin.from("captains_tables").select("id").eq("event_id", access.event_id);
      const incomingTableIds = body.tables.map((table: Record<string, unknown>) => table.id).filter(isUuid);
      const removedTableIds = (oldTables || []).map((row: { id: string }) => row.id).filter((id: string) => !incomingTableIds.includes(id));
      if (removedTableIds.length) await admin.from("captains_tables").delete().in("id", removedTableIds);
      for (let index = 0; index < body.tables.length; index += 1) {
        const table = body.tables[index] as Record<string, unknown>;
        const row = { ...pick(table, ["table_name", "captain_name", "captain_photo_url", "captain_sprite", "captain_sprite_config"]), active_captain_name: table.captain_name || null, event_id: access.event_id, table_number: index + 1 };
        if (isUuid(table.id)) await admin.from("captains_tables").update(row).eq("id", table.id).eq("event_id", access.event_id);
        else await admin.from("captains_tables").insert(row);
      }

      const { data: oldChallenges } = await admin.from("captains_event_challenges").select("id").eq("event_id", access.event_id);
      const incomingChallengeIds = body.challenges.map((challenge: Record<string, unknown>) => challenge.id).filter(isUuid);
      const removedChallengeIds = (oldChallenges || []).map((row: { id: string }) => row.id).filter((id: string) => !incomingChallengeIds.includes(id));
      if (removedChallengeIds.length) await admin.from("captains_event_challenges").delete().in("id", removedChallengeIds);
      for (let index = 0; index < body.challenges.length; index += 1) {
        const challenge = body.challenges[index] as Record<string, unknown>;
        const hasTimeLimit = challenge.has_time_limit === true;
        const row = { ...pick(challenge, ["catalog_challenge_id", "title", "description", "evidence_type", "points", "category", "difficulty", "question_options", "question_correct_option"]), catalog_challenge_id: isUuid(challenge.catalog_challenge_id) ? challenge.catalog_challenge_id : null, has_time_limit: hasTimeLimit, time_limit_seconds: hasTimeLimit ? Number(challenge.time_limit_seconds) || 60 : null, is_required: typeof challenge.is_required === "boolean" ? challenge.is_required : true, event_id: access.event_id, order_index: index + 1 };
        if (isUuid(challenge.id)) await admin.from("captains_event_challenges").update(row).eq("id", challenge.id).eq("event_id", access.event_id);
        else await admin.from("captains_event_challenges").insert(row);
      }
      return json({ event: updatedEvent, mode: "edit" });
    }
    return json({ error: "CODE_ALREADY_USED" }, 409);
  }
  if (access.redeemed_at) return json({ error: "INVALID_CODE" }, 400);
  if (body.action === "validate") return json({ valid: true, mode: "create", maxTables: access.max_tables });
  if (body.action !== "create" || !body.event?.name || !Array.isArray(body.tables) || !Array.isArray(body.challenges)) return json({ error: "INVALID_PAYLOAD" }, 400);
  if (body.tables.length < 1 || body.tables.length > access.max_tables) return json({ error: "TABLE_LIMIT_EXCEEDED", maxTables: access.max_tables }, 400);
  if (body.challenges.length < 1 || body.challenges.length > MAX_CHALLENGES) return json({ error: "CHALLENGE_LIMIT_EXCEEDED", maxChallenges: MAX_CHALLENGES }, 400);

  const contactEmail = String(body.event.contact_email || "").trim().toLowerCase();
  if (!isEmail(contactEmail)) return json({ error: "INVALID_EMAIL" }, 400);
  let ownerId: string;
  let managementPassword: string | null = null;
  let managementEmail = contactEmail;
  if (access.account_owner_id && authenticatedUserId) {
    ownerId = authenticatedUserId;
    const { data: accountData, error: accountError } = await admin.auth.admin.getUserById(ownerId);
    if (accountError || !accountData.user?.email) return json({ error: "ACCOUNT_NOT_FOUND" }, 404);
    managementEmail = accountData.user.email.trim().toLowerCase();
    const { error: profileError } = await admin.from("user_profiles").upsert({
      id: ownerId,
      phone: String(body.event.contact_phone || "").trim() || null,
    }, { onConflict: "id" });
    if (profileError) return json({ error: "CREATE_PROFILE_FAILED", detail: profileError.message }, 500);
  } else {
    const resolved = await resolveManagementAccount(
      admin,
      contactEmail,
      String(body.event.contact_phone || "").trim() || null,
    );
    ownerId = resolved.ownerId;
    managementPassword = resolved.managementPassword;
  }

  let slug = slugify(body.event.name);
  for (let suffix = 2;; suffix += 1) {
    const { data } = await admin.from("captains_events").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${slugify(body.event.name)}-${suffix}`;
  }
  const publicUrl = `${CAPTAINS_PUBLIC_ORIGIN}/capitanes/${slug}`;
  const qrImageUrl = getQrImageUrl(publicUrl);
  const eventBase = {
    ...pick(body.event, ["name", "description", "end_time"]),
    start_time: new Date().toISOString(),
    scoring_mode: "automatic",
    status: "active",
    show_live_gallery_after_completion: true,
    owner_id: ownerId,
  };
  const eventOptional = {
    ...pick(body.event, ["contact_name", "contact_email", "contact_phone"]),
    theme_style: "pixel",
    primary_color: "#f06a5f",
    secondary_color: "#2f292d",
    background_image_url: null,
  };
  let eventResult = await admin.from("captains_events").insert({ ...eventBase, ...eventOptional, slug, public_url: publicUrl, qr_url: qrImageUrl }).select("*").single();
  if (eventResult.error && Object.keys(eventOptional).some((key) => eventResult.error.message.includes(key))) {
    eventResult = await admin.from("captains_events").insert({ ...eventBase, slug, public_url: publicUrl, qr_url: qrImageUrl }).select("*").single();
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
    ...pick(challenge, ["catalog_challenge_id", "title", "description", "evidence_type", "points", "category", "difficulty", "question_options", "question_correct_option"]),
    catalog_challenge_id: isUuid(challenge.catalog_challenge_id) ? challenge.catalog_challenge_id : null,
    has_time_limit: challenge.has_time_limit === true,
    time_limit_seconds: challenge.has_time_limit === true ? Number(challenge.time_limit_seconds) || 60 : null,
    is_required: typeof challenge.is_required === "boolean" ? challenge.is_required : true,
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
  await admin.from("purchases").update({
    status: "redeemed",
    redeemed_at: new Date().toISOString(),
  }).eq("redeem_token", code).eq("plan_id", "captains");
  const credentials = {
    email: managementEmail,
    password: managementPassword,
  };
  const emailSent = await sendOwnerSummaryEmail({
    event,
    contactInfo: {
      name: String(body.event.contact_name || "").trim(),
      email: contactEmail,
      phone: String(body.event.contact_phone || "").trim(),
    },
    publicUrl,
    qrImageUrl,
    adminUrl: `${CAPTAINS_PUBLIC_ORIGIN}/admin/capitanes/${event.id}?code=${encodeURIComponent(code)}`,
    tableCount: tableRows.length,
    challengeCount: challengeRows.length,
    credentials,
  });
  return json({
    event,
    credentials,
    emailSent,
  });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("redeem-captains-code unexpected error:", error);
    return json({ error: "UNEXPECTED_ERROR", detail }, 500);
  }
});
