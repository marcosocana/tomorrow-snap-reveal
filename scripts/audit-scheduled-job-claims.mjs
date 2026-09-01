import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260902090000_optimize_scheduled_job_claims.sql");
const demoWorker = read("supabase/functions/process-demo-lifecycle-emails/index.ts");
const capsuleWorker = read("supabase/functions/process-time-capsule-unlocks/index.ts");
const demoSchedule = read("supabase/migrations/20260804153000_add_demo_lifecycle_emails.sql");
const capsuleSchedule = read("supabase/migrations/20260816170000_time_capsule_unlock_access.sql");

assert.match(demoSchedule, /'process-demo-lifecycle-emails',\s*'\*\/5 \* \* \* \*'/);
assert.match(capsuleSchedule, /'process-time-capsule-unlocks',\s*'\*\/5 \* \* \* \*'/);
assert.doesNotMatch(migration, /cron\.(?:schedule|unschedule)/);

assert.match(migration, /demo_lifecycle_email_jobs_processing_updated_idx[\s\S]*WHERE status = 'processing'/);
assert.match(migration, /time_capsule_unlock_processing_updated_idx[\s\S]*WHERE status = 'processing'/);
assert.equal((migration.match(/FOR UPDATE SKIP LOCKED/g) || []).length, 2);
assert.equal((migration.match(/AND pending_job\.due_at <= worker_now/g) || []).length, 2);
assert.equal((migration.match(/AND stale_job\.updated_at < stale_before/g) || []).length, 2);
assert.equal((migration.match(/attempts = claimed_job\.attempts \+ 1/g) || []).length, 2);
assert.equal((migration.match(/LIMIT safe_batch_limit/g) || []).length, 2);
assert.equal((migration.match(/TO service_role/g) || []).length, 2);

assert.match(demoWorker, /rpc\("claim_demo_lifecycle_email_jobs"/);
assert.match(capsuleWorker, /rpc\("claim_time_capsule_unlock_jobs"/);
assert.doesNotMatch(demoWorker, /\.eq\("status", "pending"\)/);
assert.doesNotMatch(capsuleWorker, /\.eq\("status", "pending"\)/);
assert.doesNotMatch(demoWorker, /Recovered stale processing job/);
assert.doesNotMatch(capsuleWorker, /Recovered stale processing job/);

assert.match(demoSchedule, /dedupe_key text NOT NULL UNIQUE/);
assert.match(demoSchedule, /ON CONFLICT \(dedupe_key\) DO NOTHING/g);
assert.match(capsuleSchedule, /event_id uuid PRIMARY KEY/);

console.log("Scheduled job claim audit passed (locking, recovery, indexes, dedupe, and cron frequency). ");
