import { supabase } from "@/integrations/supabase/client";

export type EventMediaCounts = {
  photos: number;
  videos: number;
  audios: number;
};

export type EventMediaCountsByEventId = Record<string, EventMediaCounts>;

const batchRequestsInFlight = new Map<string, Promise<EventMediaCountsByEventId>>();

export const getEventMediaCountsBatch = async (
  eventIds: string[],
): Promise<EventMediaCountsByEventId> => {
  const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)));
  if (uniqueEventIds.length === 0) return {};

  const requestKey = [...uniqueEventIds].sort().join("\u0000");
  const existingRequest = batchRequestsInFlight.get(requestKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const { data, error } = await supabase.rpc("get_event_media_counts_batch", {
      target_event_ids: uniqueEventIds,
    });

    if (error) throw error;

    return (data ?? []).reduce<EventMediaCountsByEventId>((countsByEventId, counts) => {
      countsByEventId[counts.event_id] = {
        photos: Number(counts.photo_count ?? 0),
        videos: Number(counts.video_count ?? 0),
        audios: Number(counts.audio_count ?? 0),
      };
      return countsByEventId;
    }, {});
  })();

  batchRequestsInFlight.set(requestKey, request);
  try {
    return await request;
  } finally {
    if (batchRequestsInFlight.get(requestKey) === request) {
      batchRequestsInFlight.delete(requestKey);
    }
  }
};

export const getEventMediaCounts = async (eventId: string): Promise<EventMediaCounts> => {
  const counts = (await getEventMediaCountsBatch([eventId]))[eventId];
  if (!counts) {
    throw new Error("Event media counts are unavailable");
  }
  return counts;
};
