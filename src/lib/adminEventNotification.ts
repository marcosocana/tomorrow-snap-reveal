import { supabase } from "@/integrations/supabase/client";

type NewEventNotificationPayload = {
  id?: string | null;
  name?: string | null;
  max_photos?: number | null;
  plan_id?: string | null;
  type?: string | null;
  is_demo?: boolean | null;
};

export const notifyAdminNewEvent = async (
  event: NewEventNotificationPayload,
  planLabel?: string | null
) => {
  try {
    const { error } = await supabase.functions.invoke("notify-admin-new-event", {
      body: { event, planLabel },
    });
    if (error) {
      console.error("notify-admin-new-event error:", error);
    }
  } catch (error) {
    console.error("notify-admin-new-event error:", error);
  }
};

