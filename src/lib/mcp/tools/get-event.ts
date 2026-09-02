import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const EVENT_FIELDS =
  "id, name, description, type, plan_id, is_demo, created_at, upload_start_time, upload_end_time, reveal_time, expiry_date, expiry_redirect_url, timezone, language, country_code, max_photos, max_videos, max_audios, max_video_duration, max_audio_duration, allow_video_recording, allow_audio_recording, allow_image_attachment, allow_video_attachment, allow_photo_deletion, allow_photo_sharing, like_counting_enabled, gallery_view_mode, hide_reveal_date, font_family, font_size, header_style, folder_id";

export default defineTool({
  name: "get_event",
  title: "Get event details",
  description:
    "Get the full configuration of one event owned by the signed-in account. Never returns event or admin passwords.",
  inputSchema: {
    event_id: z.string().uuid().describe("UUID of the event."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_FIELDS)
      .eq("id", event_id)
      .eq("owner_id", ctx.getUserId())
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "Event not found for this account." }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { event: data },
    };
  },
});
