import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEventsTool from "./tools/list-events";
import getEventTool from "./tools/get-event";
import getEventMediaCountsTool from "./tools/get-event-media-counts";
import updateEventScheduleTool from "./tools/update-event-schedule";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tomorrow-s-album",
  title: "Tomorrow's Album",
  version: "0.1.0",
  instructions:
    "Tools for Revelao / Tomorrow's Album, the disposable-camera app where guest photos stay hidden until a scheduled reveal. Use `list_events` to find the signed-in owner's events, `get_event` for one event's configuration, `get_event_media_counts` for how much media has been captured, and `update_event_schedule` to move the upload window or reveal time. All tools act as the signed-in user and only see events they own.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEventsTool, getEventTool, getEventMediaCountsTool, updateEventScheduleTool],
});
