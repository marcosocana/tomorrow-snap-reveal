import { supabase } from "@/integrations/supabase/client";

export type EventMediaCounts = {
  photos: number;
  videos: number;
  audios: number;
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
