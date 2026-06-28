import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveCaptainsEvidence,
  createCaptainsEvent,
  getCaptainsChallengeCatalog,
  getCaptainsEventDetail,
  getCaptainsEvidence,
  getCaptainsRanking,
  listCaptainsEvents,
  rejectCaptainsEvidence,
  updateCaptainsEvent,
} from "@/lib/captainsService";
import type { CaptainsEvidenceStatus, CreateCaptainsEventInput } from "@/lib/captainsTypes";

export const captainsQueryKeys = {
  events: () => ["captains", "events"] as const,
  event: (identifier: string | null | undefined) => ["captains", "event", identifier] as const,
  catalog: (activeOnly: boolean) => ["captains", "catalog", activeOnly] as const,
  ranking: (eventId: string | null | undefined) => ["captains", "ranking", eventId] as const,
  evidence: (eventId: string | null | undefined, status?: CaptainsEvidenceStatus) =>
    ["captains", "evidence", eventId, status] as const,
};

export const useCaptainsEvents = () =>
  useQuery({
    queryKey: captainsQueryKeys.events(),
    queryFn: listCaptainsEvents,
  });

export const useCaptainsEventDetail = (identifier: string | null | undefined) =>
  useQuery({
    queryKey: captainsQueryKeys.event(identifier),
    queryFn: () => getCaptainsEventDetail(identifier || ""),
    enabled: Boolean(identifier),
  });

export const useCaptainsChallengeCatalog = (activeOnly = true) =>
  useQuery({
    queryKey: captainsQueryKeys.catalog(activeOnly),
    queryFn: () => getCaptainsChallengeCatalog(activeOnly),
  });

export const useCaptainsRanking = (eventId: string | null | undefined) =>
  useQuery({
    queryKey: captainsQueryKeys.ranking(eventId),
    queryFn: () => getCaptainsRanking(eventId || ""),
    enabled: Boolean(eventId),
  });

export const useCaptainsEvidence = (eventId: string | null | undefined, status?: CaptainsEvidenceStatus) =>
  useQuery({
    queryKey: captainsQueryKeys.evidence(eventId, status),
    queryFn: () => getCaptainsEvidence(eventId || "", status),
    enabled: Boolean(eventId),
  });

export const useCreateCaptainsEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCaptainsEventInput) => createCaptainsEvent(input),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ["captains"] });
      queryClient.setQueryData(captainsQueryKeys.event(event.id), {
        event,
        tables: [],
        challenges: [],
      });
    },
  });
};

export const useUpdateCaptainsEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, input }: { eventId: string; input: Partial<CreateCaptainsEventInput> }) =>
      updateCaptainsEvent(eventId, input),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ["captains"] });
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.event(event.id) });
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.event(event.slug) });
    },
  });
};

export const useApproveCaptainsEvidence = (eventId?: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ evidenceId, pointsAwarded, adminComment }: {
      evidenceId: string;
      pointsAwarded?: number;
      adminComment?: string | null;
    }) => approveCaptainsEvidence(evidenceId, { pointsAwarded, adminComment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.evidence(eventId) });
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.ranking(eventId) });
    },
  });
};

export const useRejectCaptainsEvidence = (eventId?: string | null) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ evidenceId, adminComment }: { evidenceId: string; adminComment?: string | null }) =>
      rejectCaptainsEvidence(evidenceId, adminComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.evidence(eventId) });
      queryClient.invalidateQueries({ queryKey: captainsQueryKeys.ranking(eventId) });
    },
  });
};
