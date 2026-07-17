import { supabase } from "@/integrations/supabase/client";

interface DeleteEventsResponse {
  deleted_events: number;
  deleted_objects: number;
}

export const deleteRevelaoEventsCompletely = async (
  eventIds: string[],
  options?: { adminPassword?: string | null },
) => {
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
  if (uniqueIds.length === 0) return { deleted_events: 0, deleted_objects: 0 };

  const { data, error } = await supabase.functions.invoke("delete-events-completely", {
    body: {
      eventIds: uniqueIds,
      adminPassword: options?.adminPassword?.trim() || null,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.detail || data.error);

  uniqueIds.forEach((eventId) => localStorage.removeItem(`event-qr-url-${eventId}`));
  return data as DeleteEventsResponse;
};
