import { supabase } from "@/integrations/supabase/client";

export type EventMediaCounts = {
  photos: number;
  videos: number;
  audios: number;
};

export type EventMediaCountsByEventId = Record<string, EventMediaCounts>;

export const getEventMediaCountsBatch = async (
  eventIds: string[],
): Promise<EventMediaCountsByEventId> => {
  const uniqueEventIds = Array.from(new Set(eventIds.filter(Boolean)));
  if (uniqueEventIds.length === 0) return {};

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
};

export const getEventMediaCounts = async (eventId: string): Promise<EventMediaCounts> => {
  const { data, error } = await supabase.rpc("get_event_media_counts", {
    target_event_id: eventId,
  });

  if (error) throw error;

  const counts = data?.[0];
  if (!counts) {
    throw new Error("Event media counts are unavailable");
  }

  return {
    photos: Number(counts.photo_count ?? 0),
    videos: Number(counts.video_count ?? 0),
    audios: Number(counts.audio_count ?? 0),
  };
};
