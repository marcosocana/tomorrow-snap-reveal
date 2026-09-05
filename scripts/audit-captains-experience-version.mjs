import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260905160000_add_captains_experience_version.sql");
const unlockMigration = read("supabase/migrations/20260905173000_unlock_first_challenge_for_captains_v2.sql");
const app = read("src/App.tsx");
const router = read("src/pages/CaptainsExperience.tsx");
const service = read("src/lib/captainsService.ts");
const redeem = read("supabase/functions/redeem-captains-code/index.ts");
const onboarding = read("src/pages/CaptainsAdmin.tsx");
const v2Hook = read("src/hooks/useCaptainsV2.ts");

assert.match(migration, /ADD COLUMN IF NOT EXISTS experience_version text NOT NULL DEFAULT 'legacy'/);
assert.match(migration, /WHERE slug = 'demo-capitanes-v2'/);
assert.match(migration, /ALTER COLUMN experience_version SET DEFAULT 'v2'/);
assert.match(migration, /CHECK \(experience_version IN \('legacy', 'v2'\)\)/);

assert.match(app, /path="\/capitanes\/:eventSlug" element=\{<CaptainsExperience \/>\}/);
assert.match(router, /experience_version === "v2"/);
assert.match(router, /return <CaptainsPublic \/>/);

assert.match(service, /experience_version: input\.experience_version \?\? "v2"/);
assert.match(redeem, /experience_version: "v2"/);
assert.match(redeem, /status: index === 0 \? "ready" : "pending"/);
assert.match(unlockMigration, /event\.experience_version = 'v2'/);
assert.match(unlockMigration, /SET status = 'ready'/);
assert.match(onboarding, /!editingEventId \? \{ experience_version: "v2" as const \} : \{\}/);
assert.match(onboarding, /event: \{ \.\.\.eventPayload, experience_version: "v2" \}/);
assert.match(v2Hook, /sessionKeyForEvent\(eventSlug\)/);
assert.match(v2Hook, /getCaptainsEventDetail\(eventSlug\)/);

console.log("Captains experience version audit passed: existing events stay legacy and both creation paths produce v2 events.");
