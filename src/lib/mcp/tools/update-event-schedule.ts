import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_event_schedule",
  title: "Update event schedule",
  description:
    "Update the upload window and/or the reveal time of an event owned by the signed-in account. Timestamps must be ISO 8601 with timezone offset.",
  inputSchema: {
    event_id: z.string().uuid().describe("UUID of the event."),
    upload_start_time: z.string().datetime({ offset: true }).optional().describe("New upload window start."),
    upload_end_time: z.string().datetime({ offset: true }).optional().describe("New upload window end."),
    reveal_time: z.string().datetime({ offset: true }).optional().describe("New reveal time."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id, upload_start_time, upload_end_time, reveal_time }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const patch: Record<string, string> = {};
    if (upload_start_time) patch.upload_start_time = upload_start_time;
    if (upload_end_time) patch.upload_end_time = upload_end_time;
    if (reveal_time) patch.reveal_time = reveal_time;
    if (Object.keys(patch).length === 0) {
      return {
        content: [{ type: "text", text: "Provide at least one of upload_start_time, upload_end_time or reveal_time." }],
        isError: true,
      };
    }

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("events")
      .update(patch)
      .eq("id", event_id)
      .eq("owner_id", ctx.getUserId())
      .select("id, name, upload_start_time, upload_end_time, reveal_time")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return { content: [{ type: "text", text: "Event not found for this account." }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { event: data },
    };
  },
});
