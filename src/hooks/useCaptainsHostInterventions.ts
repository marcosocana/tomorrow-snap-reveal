import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { claimCaptainsHostIntervention, getCaptainsHostInterventions, markCaptainsHostIntervention } from "@/lib/captainsService";
import { deterministicHostVariant, selectHostIntervention, type CaptainsHostGameSnapshot } from "@/lib/captainsHostEngine";
import { getHostMessageFromCatalog } from "@/lib/captainsHostMessages";
import { normalizeCaptainsHostConfig } from "@/lib/captainsHosts";
import type { CaptainsEvent, CaptainsHostInterventionRecord, CaptainsRankingItem, CaptainsTable } from "@/lib/captainsTypes";

export function useCaptainsHostInterventions({ event, team, ranking, completedChallenges, totalChallenges, joined, finished }: {
  event?: CaptainsEvent;
  team?: CaptainsTable;
  ranking: CaptainsRankingItem[];
  completedChallenges: number;
  totalChallenges: number;
  joined: boolean;
  finished: boolean;
}) {
  const config = useMemo(() => normalizeCaptainsHostConfig(event), [event]);
  const [active, setActive] = useState<CaptainsHostInterventionRecord | null>(null);
  const previous = useRef<CaptainsHostGameSnapshot | null>(null);
  const attempted = useRef("");
  const dismissedLocally = useRef(new Set<string>());
  const position = team ? ranking.findIndex(item => item.id === team.id) + 1 : 0;
  const snapshot = useMemo<CaptainsHostGameSnapshot>(() => ({
    points: team?.total_points ?? 0,
    completedChallenges,
    totalChallenges,
    position,
    leaderTeam: ranking[0]?.table_name,
    overtakingTeam: position > 1 ? ranking[position - 2]?.table_name : undefined,
    now: Date.now(),
    finished,
  }), [team?.total_points, completedChallenges, totalChallenges, position, ranking, finished]);
  const history = useQuery({
    queryKey: ["captains-host-interventions", event?.id, team?.id],
    enabled: Boolean(config.enabled && joined && event?.id && team?.id),
    queryFn: () => getCaptainsHostInterventions(event!.id, team!.id),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!config.enabled || !joined) { setActive(null); previous.current = null; return; }
    const pending = history.data?.find(item => !new Set<string>(["HALFWAY_TIME", "TIME_REMAINING_30", "TIME_REMAINING_10"]).has(item.trigger) && item.status !== "dismissed" && !dismissedLocally.current.has(item.id));
    if (pending && !active) {
      setActive(pending);
      if (pending.status === "pending") void markCaptainsHostIntervention(pending.id, "shown").then(() => history.refetch());
    }
  }, [active, config.enabled, history, joined]);

  useEffect(() => {
    if (!config.enabled || !joined || !event || !team || history.isPending || active) return;
    const oldSnapshot = previous.current;
    const candidate = selectHostIntervention({ current: snapshot, previous: oldSnapshot, history: history.data ?? [], frequency: config.frequency, enabled: true });
    previous.current = snapshot;
    if (!candidate) return;
    const attemptKey = `${candidate.trigger}:${snapshot.points}:${snapshot.completedChallenges}:${snapshot.position}`;
    if (attempted.current === attemptKey) return;
    attempted.current = attemptKey;
    const variant = deterministicHostVariant(team.id, candidate.trigger);
    void claimCaptainsHostIntervention({ eventId: event.id, tableId: team.id, trigger: candidate.trigger, variant, payload: { priority: candidate.priority } }).then(record => {
      if (!record) return;
      setActive(record);
      void markCaptainsHostIntervention(record.id, "shown");
      window.dispatchEvent(new CustomEvent("host_intervention_shown", { detail: { event_id: event.id, team_id: team.id, trigger: candidate.trigger, tone: config.tone, variant } }));
    });
  }, [active, config, event, history.data, history.isPending, joined, snapshot, team]);

  const message = active ? getHostMessageFromCatalog(active.trigger, config.tone, active.variant, {
    teamName: team?.table_name,
    teamNumber: team?.table_number,
    points: team?.total_points,
    position,
    leaderTeam: ranking[0]?.table_name,
    otherTeam: snapshot.overtakingTeam,
    completedChallenges,
    partner1: config.wedding.partner_1_nickname || config.wedding.partner_1_name,
    partner2: config.wedding.partner_2_nickname || config.wedding.partner_2_name,
    yearsTogether: config.wedding.years_together,
    venue: config.wedding.venue_name,
    city: config.wedding.venue_city,
  }) : null;

  const dismiss = async () => {
    if (!active) return;
    const current = active;
    dismissedLocally.current.add(current.id);
    setActive(null);
    await markCaptainsHostIntervention(current.id, "dismissed");
    window.dispatchEvent(new CustomEvent("host_intervention_dismissed", { detail: { event_id: event?.id, team_id: team?.id, trigger: current.trigger, tone: config.tone, variant: current.variant } }));
    await history.refetch();
  };

  return { config, active, message, dismiss };
}
