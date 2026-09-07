import assert from "node:assert/strict";
import { collectHostEventCandidates, selectHostIntervention } from "../src/lib/captainsHostEngine.ts";
import { getHostMessageFromCatalog } from "../src/lib/captainsHostMessages.ts";

const now = Date.parse("2026-09-07T20:00:00Z");
const snapshot = (patch = {}) => ({ points: 0, completedChallenges: 0, totalChallenges: 10, position: 5, startedAt: "2026-09-07T19:00:00Z", endsAt: "2026-09-07T23:00:00Z", now, finished: false, ...patch });
const record = (trigger, minutesAgo = 20) => ({ id: trigger, event_id: "event", table_id: "team", intervention_type: "host_message", trigger, variant: 0, status: "dismissed", payload: null, created_at: new Date(now - minutesAgo * 60_000).toISOString(), shown_at: null, dismissed_at: new Date(now - minutesAgo * 60_000).toISOString() });
const choose = (current, previous, history = [], frequency = "normal", enabled = true) => selectHostIntervention({ current, previous, history, frequency, enabled });

assert.equal(choose(snapshot({ points: 50 }), snapshot({ points: 40 }))?.trigger, "POINTS_50");
assert.equal(choose(snapshot({ points: 50 }), snapshot({ points: 40 }), [record("POINTS_50")]), null);
assert.equal(choose(snapshot({ points: 100 }), snapshot({ points: 80 }))?.trigger, "POINTS_100");
assert.equal(choose(snapshot({ position: 3 }), snapshot({ position: 4 }))?.trigger, "ENTERED_PODIUM");
assert.equal(choose(snapshot({ position: 3 }), snapshot({ position: 3 })), null);
assert.equal(choose(snapshot({ position: 1 }), snapshot({ position: 2 }))?.trigger, "BECAME_LEADER");
assert.equal(choose(snapshot({ position: 1 }), snapshot({ position: 1 })), null);
assert.equal(choose(snapshot({ completedChallenges: 5 }), snapshot({ completedChallenges: 4 }))?.trigger, "HALFWAY_CHALLENGES");
assert.equal(choose(snapshot({ completedChallenges: 5 }), snapshot({ completedChallenges: 4 }), [record("HALFWAY_CHALLENGES")]), null);
assert.equal(choose(snapshot({ completedChallenges: 8 }), snapshot({ completedChallenges: 7 }), [record("FINAL_CHALLENGES")])?.trigger, "THREE_QUARTERS_CHALLENGES");
assert.equal(choose(snapshot({ completedChallenges: 9 }), snapshot({ completedChallenges: 8 }))?.trigger, "LAST_CHALLENGE");
for (const frequency of ["low", "normal", "high"]) {
  assert.equal(choose(snapshot({ now: Date.parse("2026-09-07T22:55:00Z") }), snapshot(), [], frequency), null);
  assert.equal(choose(snapshot({ completedChallenges: 9 }), snapshot({ completedChallenges: 8 }), [], frequency)?.trigger, "LAST_CHALLENGE");
}
assert.equal(choose(snapshot({ completedChallenges: 8 }), snapshot({ completedChallenges: 7 }), [], "low"), null);
assert.equal(choose(snapshot({ completedChallenges: 10, finished: true }), snapshot({ completedChallenges: 9 }))?.trigger, "GAME_FINISHED");
assert.equal(choose(snapshot({ points: 50 }), snapshot({ points: 40 }), [record("FIRST_CHALLENGE_COMPLETED", 1)]), null);
assert.equal(choose(snapshot({ points: 50, position: 1 }), snapshot({ points: 40, position: 2 }))?.trigger, "BECAME_LEADER");
assert.equal(choose(snapshot({ points: 50 }), snapshot({ points: 40 }), [], "normal", false), null);
assert.deepEqual(collectHostEventCandidates(snapshot({ position: 3 }), snapshot({ position: 3 })).filter(item => item.trigger === "ENTERED_PODIUM"), []);
assert.equal(getHostMessageFromCatalog("GAME_FINISHED", "divertido", 0, { points: 87 }).line2.includes("87"), true);
assert.equal(getHostMessageFromCatalog("GAME_STARTED", "divertido", 0, { teamName: "Mesa 4" }).line1, "¡Bienvenidos, Mesa 4!");
assert.equal(getHostMessageFromCatalog("TEAM_OVERTAKEN", "divertido", 0, {}).line2.includes("{"), false);

console.log("PASS: host triggers, thresholds, transitions, deduplication, cooldown, priority, disabled state and safe templates.");
