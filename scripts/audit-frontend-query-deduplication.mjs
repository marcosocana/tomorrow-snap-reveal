import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const app = read("src/App.tsx");
const main = read("src/main.tsx");
const eventManagement = read("src/pages/EventManagement.tsx");
const eventForm = read("src/pages/EventForm.tsx");
const mediaCounts = read("src/lib/eventMediaCounts.ts");
const captainsHooks = read("src/hooks/useCaptains.ts");
const galleryPreview = read("src/components/GalleryPreviewModal.tsx");
const slideshow = read("src/pages/LiveSlideshow.tsx");

assert(!main.includes("<React.StrictMode"), "React Strict Mode must not duplicate production mounts");
assert(app.includes("<QueryClientProvider client={queryClient}>"), "TanStack Query provider is missing");

assert(eventManagement.includes("await loadData(session);"), "EventManagement does not reuse its resolved session");
assert(
  eventManagement.includes("const loadData = async (knownSession?: Session | null)"),
  "EventManagement loadData cannot accept a resolved session",
);
assert(
  eventForm.includes("loadEvent(isAdminUser);") && eventForm.includes("knownIsSuperAdmin?: boolean"),
  "EventForm still resolves the same auth state twice during its initial edit load",
);

assert(
  mediaCounts.includes("batchRequestsInFlight.get(requestKey)"),
  "Media-count RPC calls are not deduplicated in flight",
);
assert(
  mediaCounts.includes("batchRequestsInFlight.delete(requestKey)"),
  "Media-count in-flight entries are not cleaned up",
);
assert(
  mediaCounts.includes("getEventMediaCountsBatch([eventId])")
    && !mediaCounts.includes('rpc("get_event_media_counts"'),
  "Single-event counts do not share the batch RPC path",
);

assert(
  captainsHooks.includes("staleTime: CAPTAINS_CATALOG_STALE_TIME_MS"),
  "The shared Captains catalog has no remount/focus cache window",
);

const mediaEffect = galleryPreview.match(/useEffect\(\(\) => \{\s+if \(open && eventId\) \{\s+loadVideos\(\);\s+loadAudios\(\);[\s\S]*?\}, \[open, eventId\]\);/);
assert(mediaEffect, "Gallery preview still ties video/audio fetching to photo sorting");

assert(
  slideshow.includes("supabasePublic.removeChannel(channel)"),
  "LiveSlideshow does not release its Realtime channel",
);

console.log("Frontend Supabase deduplication audit passed.");
