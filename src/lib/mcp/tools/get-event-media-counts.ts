import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_event_media_counts",
  title: "Get event media counts",
  description:
    "Count the photos, videos and audios uploaded to one event owned by the signed-in account, even before the reveal.",
  inputSchema: {
    event_id: z.string().uuid().describe("UUID of the event."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", event_id)
      .eq("owner_id", ctx.getUserId())
      .maybeSingle();
    if (eventError) return { content: [{ type: "text", text: eventError.message }], isError: true };
    if (!event) {
      return { content: [{ type: "text", text: "Event not found for this account." }], isError: true };
    }

    const { data, error } = await supabase.rpc("get_event_media_counts", {
      target_event_id: event_id,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const row = Array.isArray(data) ? data[0] : data;
    const counts = {
      event_id,
      event_name: event.name,
      photo_count: Number(row?.photo_count ?? 0),
      video_count: Number(row?.video_count ?? 0),
      audio_count: Number(row?.audio_count ?? 0),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(counts, null, 2) }],
      structuredContent: counts,
    };
  },
});
