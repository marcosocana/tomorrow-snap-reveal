import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const gallery = read("src/pages/Gallery.tsx");
const camera = read("src/pages/Camera.tsx");
const access = read("src/pages/EventAccess.tsx");
const login = read("src/pages/Login.tsx");
const hook = read("src/hooks/useLiveEventConfig.ts");
const migration = [
  read("supabase/migrations/20260902182055_1102e3a2-1580-482c-bcaf-a490ae012ce8.sql"),
  read("supabase/migrations/20260902182824_553c670f-5e67-4f22-bdaf-56835367e8b5.sql"),
].join("\n");

for (const [name, source] of [["Gallery", gallery], ["Camera", camera]]) {
  assert(!source.includes("loadEventData"), `${name} still has the old event loader`);
  assert(!/setInterval[\s\S]{0,180}15000/.test(source), `${name} still polls event config every 15 seconds`);
  assert(!/select\([^)]*password_hash/.test(source), `${name} selects password_hash`);
}

assert(hook.includes('.from("public_event_configs"'), "Initial config does not use the safe projection");
assert(hook.includes("filter: `event_id=eq.${eventId}`"), "Realtime is not filtered by event ID");
assert(hook.includes("supabase.removeChannel(channel)"), "Realtime channel is not removed on unmount");
assert(hook.includes("() => void refresh()"), "Realtime bypasses the screen-specific projection");
assert(hook.includes('window.addEventListener("focus"'), "Focus revalidation is missing");
assert(hook.includes('window.addEventListener("online"'), "Reconnect revalidation is missing");
assert(hook.includes("config.upload_start_time"), "Upload-start timer is missing");
assert(hook.includes("config.upload_end_time"), "Upload-end timer is missing");
assert(hook.includes("config.reveal_time"), "Reveal timer is missing");
assert(hook.includes("config.expiry_date"), "Expiry timer is missing");

assert(!access.includes('.eq("password_hash"'), "URL access still filters password_hash in REST");
assert(!login.includes('.eq("password_hash"'), "Password login still filters password_hash in REST");
assert(access.includes('rpc("verify_event_qr_password"'), "QR password is still checked in the browser");
assert(gallery.includes('rpc("verify_event_qr_password"'), "Gallery password is still checked in the browser");
assert(migration.includes("- 'qr_password_hash'"), "Safe projection does not remove the QR hash");
assert(migration.includes("- 'deletion_lock_pin'"), "Safe projection does not remove the deletion-lock PIN");
assert(!/public_event_configs[\s\S]*password_hash text/.test(migration), "Safe projection contains password_hash");
const accessRpcResult = migration.match(
  /CREATE OR REPLACE FUNCTION public\.resolve_public_event_access[\s\S]*?RETURNS TABLE \(([\s\S]*?)\)\nLANGUAGE/,
)?.[1] || "";
assert(accessRpcResult && !accessRpcResult.includes("password_hash"), "An access RPC returns password_hash");

const fiveMinutesMs = 5 * 60 * 1000;
const previousPeriodicRequests = Math.floor(fiveMinutesMs / 15_000);
const currentPeriodicRequests = /setInterval[\s\S]{0,180}15000/.test(gallery) ? previousPeriodicRequests : 0;
assert(previousPeriodicRequests === 20, "Unexpected baseline request calculation");
assert(currentPeriodicRequests === 0, "Periodic event requests remain after five minutes");

console.log(
  `Event polling audit passed: ${previousPeriodicRequests} periodic requests/5 min before, ${currentPeriodicRequests} after.`,
);
