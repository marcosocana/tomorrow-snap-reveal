import type { CaptainsHostFrequency, CaptainsHostInterventionRecord, CaptainsHostTrigger } from "@/lib/captainsTypes";

export type CaptainsHostGameSnapshot = {
  points: number;
  completedChallenges: number;
  totalChallenges: number;
  position: number;
  leaderTeam?: string;
  overtakingTeam?: string;
  now: number;
  finished: boolean;
};

export type HostEventCandidate = { trigger: CaptainsHostTrigger; priority: 1 | 2 | 3 };

const allowedByFrequency: Record<CaptainsHostFrequency, Set<CaptainsHostTrigger>> = {
  low: new Set(["GAME_STARTED", "FIRST_CHALLENGE_COMPLETED", "POINTS_50", "POINTS_100", "HALFWAY_CHALLENGES", "BECAME_LEADER", "LAST_CHALLENGE", "GAME_FINISHED"]),
  normal: new Set(["GAME_STARTED", "FIRST_CHALLENGE_COMPLETED", "POINTS_50", "POINTS_100", "HALFWAY_CHALLENGES", "ENTERED_PODIUM", "BECAME_LEADER", "LOST_LEAD", "TEAM_OVERTAKEN", "THREE_QUARTERS_CHALLENGES", "LAST_CHALLENGE", "FINAL_CHALLENGES", "GAME_FINISHED"]),
  high: new Set(["GAME_STARTED", "FIRST_CHALLENGE_COMPLETED", "POINTS_25", "POINTS_50", "POINTS_100", "HALFWAY_CHALLENGES", "ENTERED_PODIUM", "LEFT_PODIUM", "BECAME_LEADER", "LOST_LEAD", "TEAM_OVERTAKEN", "THREE_QUARTERS_CHALLENGES", "LAST_CHALLENGE", "FINAL_CHALLENGES", "GAME_FINISHED"]),
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
  if (current.totalChallenges > 0 && !current.finished && remaining > 0) {
    if (crossed(previous?.completedChallenges, current.completedChallenges, Math.ceil(current.totalChallenges / 2))) result.push({ trigger: "HALFWAY_CHALLENGES", priority: 2 });
    if (crossed(previous?.completedChallenges, current.completedChallenges, Math.ceil(current.totalChallenges * .75))) result.push({ trigger: "THREE_QUARTERS_CHALLENGES", priority: 2 });
    if (remaining === 1 && previousRemaining !== undefined && previousRemaining > 1) result.push({ trigger: "LAST_CHALLENGE", priority: 3 });
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
  return collectHostEventCandidates(current, previous).find(candidate =>
    !shown.has(candidate.trigger) && allowedByFrequency[frequency].has(candidate.trigger)
  ) ?? null;
};

export const deterministicHostVariant = (teamId: string, trigger: CaptainsHostTrigger) =>
  [...`${teamId}:${trigger}`].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
