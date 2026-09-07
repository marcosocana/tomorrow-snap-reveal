import type { CaptainsHostFrequency, CaptainsHostInterventionRecord, CaptainsHostTrigger } from "@/lib/captainsTypes";

export type CaptainsHostGameSnapshot = {
  points: number;
  completedChallenges: number;
  totalChallenges: number;
  position: number;
  leaderTeam?: string;
  overtakingTeam?: string;
  startedAt?: string | null;
  endsAt?: string | null;
  now: number;
  finished: boolean;
};

export type HostEventCandidate = { trigger: CaptainsHostTrigger; priority: 1 | 2 | 3 };

const ordinaryCooldownMs = { low: 5 * 60_000, normal: 4 * 60_000, high: 3 * 60_000 } satisfies Record<CaptainsHostFrequency, number>;
const critical = new Set<CaptainsHostTrigger>(["GAME_FINISHED", "BECAME_LEADER", "ENTERED_PODIUM"]);
const allowedByFrequency: Record<CaptainsHostFrequency, Set<CaptainsHostTrigger>> = {
  low: new Set(["GAME_STARTED", "FIRST_CHALLENGE_COMPLETED", "POINTS_50", "POINTS_100", "HALFWAY_TIME", "BECAME_LEADER", "TIME_REMAINING_10", "GAME_FINISHED"]),
  normal: new Set(["GAME_STARTED", "FIRST_CHALLENGE_COMPLETED", "POINTS_50", "POINTS_100", "HALFWAY_TIME", "ENTERED_PODIUM", "BECAME_LEADER", "LOST_LEAD", "TEAM_OVERTAKEN", "TIME_REMAINING_30", "TIME_REMAINING_10", "FINAL_CHALLENGES", "GAME_FINISHED"]),
  high: new Set(["GAME_STARTED", "FIRST_CHALLENGE_COMPLETED", "POINTS_25", "POINTS_50", "POINTS_100", "HALFWAY_TIME", "ENTERED_PODIUM", "LEFT_PODIUM", "BECAME_LEADER", "LOST_LEAD", "TEAM_OVERTAKEN", "TIME_REMAINING_30", "TIME_REMAINING_10", "FINAL_CHALLENGES", "GAME_FINISHED"]),
};

const crossed = (previous: number | undefined, current: number, threshold: number) => previous !== undefined && previous < threshold && current >= threshold;

export const collectHostEventCandidates = (current: CaptainsHostGameSnapshot, previous?: CaptainsHostGameSnapshot | null): HostEventCandidate[] => {
  const result: HostEventCandidate[] = [];
  if (current.finished && !previous?.finished) result.push({ trigger: "GAME_FINISHED", priority: 3 });
  if (previous && previous.position !== 1 && current.position === 1) result.push({ trigger: "BECAME_LEADER", priority: 3 });
  if (previous && previous.position === 1 && current.position > 1) result.push({ trigger: "LOST_LEAD", priority: 3 });
  if (previous && previous.position > 3 && current.position > 0 && current.position <= 3) result.push({ trigger: "ENTERED_PODIUM", priority: 3 });
  if (previous && previous.position <= 3 && current.position > 3) result.push({ trigger: "LEFT_PODIUM", priority: 3 });
  if (previous && current.position > previous.position && current.overtakingTeam) result.push({ trigger: "TEAM_OVERTAKEN", priority: 2 });
  if (crossed(previous?.points, current.points, 100)) result.push({ trigger: "POINTS_100", priority: 2 });
  else if (crossed(previous?.points, current.points, 50)) result.push({ trigger: "POINTS_50", priority: 2 });
  else if (crossed(previous?.points, current.points, 25)) result.push({ trigger: "POINTS_25", priority: 1 });
  if (crossed(previous?.completedChallenges, current.completedChallenges, 1)) result.push({ trigger: "FIRST_CHALLENGE_COMPLETED", priority: 2 });
  const remaining = current.totalChallenges - current.completedChallenges;
  const previousRemaining = previous ? previous.totalChallenges - previous.completedChallenges : undefined;
  if (remaining <= 2 && remaining > 0 && previousRemaining !== undefined && previousRemaining > 2) result.push({ trigger: "FINAL_CHALLENGES", priority: 2 });
  const start = current.startedAt ? Date.parse(current.startedAt) : NaN;
  const end = current.endsAt ? Date.parse(current.endsAt) : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    if (current.now >= start + (end - start) / 2) result.push({ trigger: "HALFWAY_TIME", priority: 2 });
    if (end - current.now <= 30 * 60_000 && end - current.now > 0) result.push({ trigger: "TIME_REMAINING_30", priority: 2 });
    if (end - current.now <= 10 * 60_000 && end - current.now > 0) result.push({ trigger: "TIME_REMAINING_10", priority: 3 });
  }
  if (!previous) result.push({ trigger: "GAME_STARTED", priority: 3 });
  return result.sort((first, second) => second.priority - first.priority);
};

export const selectHostIntervention = ({ current, previous, history, frequency, enabled }: {
  current: CaptainsHostGameSnapshot;
  previous?: CaptainsHostGameSnapshot | null;
  history: CaptainsHostInterventionRecord[];
  frequency: CaptainsHostFrequency;
  enabled: boolean;
}): HostEventCandidate | null => {
  if (!enabled) return null;
  const shown = new Set(history.map(item => item.trigger));
  const lastShown = history.reduce((latest, item) => Math.max(latest, Date.parse(item.dismissed_at || item.shown_at || item.created_at) || 0), 0);
  return collectHostEventCandidates(current, previous).find(candidate => {
    if (shown.has(candidate.trigger) || !allowedByFrequency[frequency].has(candidate.trigger)) return false;
    return critical.has(candidate.trigger) || current.now - lastShown >= ordinaryCooldownMs[frequency];
  }) ?? null;
};

export const deterministicHostVariant = (teamId: string, trigger: CaptainsHostTrigger) =>
  [...`${teamId}:${trigger}`].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
