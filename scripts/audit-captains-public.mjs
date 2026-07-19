import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, assertion) => {
  assertion();
  checks.push(name);
};

const publicClientSource = read("src/integrations/supabase/publicClient.ts");
const serviceSource = read("src/lib/captainsService.ts");
const publicPageSource = read("src/pages/CaptainsPublic.tsx");
const permissionMigration = read("supabase/migrations/20260719073226_57a4c692-9363-46f0-a44d-aec3bf26ae3d.sql");
const answerMigration = read("supabase/migrations/20260719160000_store_captains_question_answers.sql");
const hardeningMigration = read("supabase/migrations/20260719190000_harden_captains_public_game.sql");

check("public client does not persist sessions", () => {
  assert.match(publicClientSource, /supabasePublic[\s\S]*persistSession:\s*false/);
  assert.match(publicClientSource, /supabasePublic[\s\S]*autoRefreshToken:\s*false/);
  assert.match(publicClientSource, /supabasePublic[\s\S]*detectSessionInUrl:\s*false/);
});

check("Captains public operations use the isolated client", () => {
  assert.match(serviceSource, /integrations\/supabase\/publicClient/);
  assert.match(serviceSource, /const pdb = supabasePublic/);
  assert.match(serviceSource, /pdb\.from\("captains_table_accesses"\)\.insert/);
  assert.match(serviceSource, /pdb[\s\S]*from\("captains_table_challenges"\)/);
});

check("Captains public uploads use the isolated storage client", () => {
  assert.match(serviceSource, /supabasePublic\.storage[\s\S]*upload\(filePath, file\)/);
  assert.match(serviceSource, /supabasePublic\.storage[\s\S]*createSignedUrl/);
});

check("public page has no direct authenticated Supabase client access", () => {
  assert.doesNotMatch(publicPageSource, /integrations\/supabase\/client/);
  assert.doesNotMatch(publicPageSource, /supabase\./);
});

check("challenge expiry releases its guard after a transient failure", () => {
  assert.match(publicPageSource, /catch \(error\)[\s\S]*expiringChallengeRef\.current = "";[\s\S]*setPhase\("progress"\)/);
});

check("anonymous gameplay grants cover every mutation", () => {
  for (const required of [
    "captain_name",
    "active_captain_name",
    "last_activity_at",
    "total_points",
    "completed_challenges",
    "failed_challenges",
    "current_challenge_id",
    "status",
    "points_awarded",
    "started_at",
    "submitted_at",
    "reviewed_at",
    "elapsed_seconds",
    "remaining_seconds",
    "is_time_expired",
    "automatic_score_calculated",
  ]) {
    assert.ok(permissionMigration.includes(required), `Missing anonymous grant for ${required}`);
  }
  assert.match(permissionMigration, /GRANT INSERT ON public\.captains_table_accesses TO anon/);
  assert.match(permissionMigration, /GRANT INSERT ON public\.captains_table_challenges TO anon/);
  assert.match(permissionMigration, /GRANT INSERT ON public\.captains_evidence TO anon/);
});

check("question_answer is created before its grant in a clean database", () => {
  assert.match(answerMigration, /ADD COLUMN IF NOT EXISTS question_answer text/);
  assert.match(answerMigration, /GRANT UPDATE \(question_answer\)/);
  assert.doesNotMatch(permissionMigration, /question_answer/);
});

check("canonical RLS blocks gameplay after event end", () => {
  for (const policy of [
    "Public can update active captains tables",
    "Public can insert active captains progress",
    "Public can update active captains progress",
    "Public can register active captains access",
    "Public can insert active captains evidence",
    "Public can upload active captain evidence files",
  ]) {
    assert.ok(hardeningMigration.includes(policy), `Missing canonical policy: ${policy}`);
  }
  assert.ok(
    (hardeningMigration.match(/captains_event_status\(event\.start_time, event\.end_time\) IN \('scheduled', 'active'\)/g) || []).length >= 7,
    "Every public mutation must be restricted by event time",
  );
  assert.doesNotMatch(hardeningMigration, /WITH CHECK \(true\)/i);
});

const parseEnv = () => {
  const result = {};
  for (const line of read(".env").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return result;
};

const remote = process.argv.includes("--remote");
if (remote) {
  const env = parseEnv();
  const baseUrl = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  assert.ok(baseUrl && key, "Missing public Supabase environment variables");
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rest = `${baseUrl}/rest/v1`;

  const request = async (name, url, init = {}, expected) => {
    const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const body = await response.text();
    assert.ok(expected.includes(response.status), `${name}: HTTP ${response.status}: ${body}`);
    checks.push(`${name} (HTTP ${response.status})`);
    return { response, body };
  };

  const demo = await request(
    "public event read",
    `${rest}/captains_events?select=id,slug,status,start_time,end_time&slug=eq.demo-capitanes`,
    {},
    [200],
  );
  const demoEvent = JSON.parse(demo.body)[0];
  assert.equal(demoEvent?.slug, "demo-capitanes", "Editable demo is missing remotely");

  const demoTables = await request(
    "editable demo tables",
    `${rest}/captains_tables?select=id&event_id=eq.${demoEvent.id}`,
    {},
    [200],
  );
  assert.ok(JSON.parse(demoTables.body).length > 0, "Editable demo has no tables");
  const demoChallenges = await request(
    "editable demo challenges",
    `${rest}/captains_event_challenges?select=id&event_id=eq.${demoEvent.id}`,
    {},
    [200],
  );
  assert.ok(JSON.parse(demoChallenges.body).length > 0, "Editable demo has no challenges");

  await request("public table read", `${rest}/captains_tables?select=id,event_id,table_name&limit=1`, {}, [200]);
  await request("public challenge read", `${rest}/captains_event_challenges?select=id,event_id,title&limit=1`, {}, [200]);
  await request("public progress read", `${rest}/captains_table_challenges?select=id,event_id,table_id,status&limit=1`, {}, [200]);

  const missingId = "00000000-0000-4000-8000-000000000000";
  await request(
    "anonymous table UPDATE grant",
    `${rest}/captains_tables?id=eq.${missingId}`,
    { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ captain_name: "audit", active_captain_name: "audit", last_activity_at: null }) },
    [204],
  );
  await request(
    "anonymous progress UPDATE grant",
    `${rest}/captains_table_challenges?id=eq.${missingId}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "ready",
        points_awarded: 0,
        started_at: null,
        submitted_at: null,
        reviewed_at: null,
        elapsed_seconds: null,
        remaining_seconds: null,
        question_answer: null,
        is_time_expired: false,
        automatic_score_calculated: false,
      }),
    },
    [204],
  );

  const assertInsertGrantBehindRls = async (name, table, payload) => {
    const result = await request(
      name,
      `${rest}/${table}`,
      { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload) },
      [400, 401, 403, 409],
    );
    assert.doesNotMatch(result.body, /permission denied for table/i, `${name}: INSERT privilege is missing`);
    assert.match(result.body, /row-level security|foreign key constraint/i, `${name}: invalid audit row was not safely rejected`);
  };

  await assertInsertGrantBehindRls("anonymous access INSERT grant", "captains_table_accesses", {
    event_id: missingId,
    table_id: missingId,
    table_name: "audit",
    captain_name: "audit",
  });
  await assertInsertGrantBehindRls("anonymous progress INSERT grant", "captains_table_challenges", {
    event_id: missingId,
    table_id: missingId,
    challenge_id: missingId,
    randomized_order_index: 1,
    status: "ready",
  });
  await assertInsertGrantBehindRls("anonymous evidence INSERT grant", "captains_evidence", {
    event_id: missingId,
    table_id: missingId,
    table_challenge_id: missingId,
    evidence_type: "photo",
    file_url: "audit/never-created.jpg",
  });
}

console.log(`Captains public audit passed (${checks.length} checks):`);
for (const name of checks) console.log(`- ${name}`);
