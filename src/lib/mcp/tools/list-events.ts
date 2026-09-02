import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const EVENT_FIELDS =
  "id, name, description, type, plan_id, is_demo, created_at, upload_start_time, upload_end_time, reveal_time, expiry_date, timezone, language, max_photos, max_videos, max_audios";

export default defineTool({
  name: "list_events",
  title: "List my events",
  description:
    "List the Revelao events owned by the signed-in account, newest first, with schedule and plan limits.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of events to return."),
    search: z.string().trim().min(1).optional().describe("Optional case-insensitive filter on the event name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("events")
      .select(EVENT_FIELDS)
      .eq("owner_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const events = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
      structuredContent: { count: events.length, events },
    };
  },
});
