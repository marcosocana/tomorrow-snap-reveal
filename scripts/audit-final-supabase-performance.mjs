import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const gallery = read("src/pages/Gallery.tsx");
const camera = read("src/pages/Camera.tsx");
const liveEventConfig = read("src/hooks/useLiveEventConfig.ts");
const galleryPreview = read("src/components/GalleryPreviewModal.tsx");
const captainsService = read("src/lib/captainsService.ts");
const signedUrlCache = read("src/lib/signedUrlCache.ts");
const slideshow = read("src/pages/LiveSlideshow.tsx");
const unlockCapsule = read("supabase/functions/unlock-time-capsule/index.ts");
const resetCaptains = read("supabase/functions/reset-captains-tables/index.ts");
const demoWorker = read("supabase/functions/process-demo-lifecycle-emails/index.ts");
const indexes = read("supabase/migrations/20260902110000_add_final_performance_indexes.sql");

const listCaptainsBody = captainsService.slice(
  captainsService.indexOf("export const listCaptainsEvents"),
  captainsService.indexOf("export const createCaptainsEvent"),
);
assert(!listCaptainsBody.includes("events.map(async"), "Captains list still performs per-event count queries");
assert(
  listCaptainsBody.includes('.select("event_id").in("event_id", eventIds)'),
  "Captains list does not batch its count inputs",
);

assert(!gallery.includes('.from("photos")\n        .select("*")'), "Gallery still transfers complete photo rows");
assert(
  gallery.includes("getSignedUrlsCached({") && gallery.includes("fullQualityUrls.get(photo.image_url)"),
  "Gallery full-quality URLs are not batched",
);
assert(galleryPreview.includes("const addPhotoUrls"), "Gallery preview photo URL generation is not batched");
assert(
  signedUrlCache.includes("inFlightRequests.get(key)") && signedUrlCache.includes("readValidCacheEntry"),
  "Signed URL cache/in-flight deduplication is missing",
);

assert(slideshow.includes("supabasePublic.removeChannel(channel)"), "Slideshow Realtime channel is not released");
assert(!gallery.includes("15000") && !camera.includes("15000"), "Event config still polls every 15 seconds");
assert(
  liveEventConfig.includes('document.visibilityState === "visible"')
    && liveEventConfig.includes('window.addEventListener("online", refresh)')
    && liveEventConfig.includes("public-event-config-${eventId}")
    && liveEventConfig.includes("supabase.removeChannel(channel)"),
  "Event config does not revalidate on resume/network or clean up its Realtime channel",
);
assert(
  unlockCapsule.includes("createSignedUrls(videoPaths, 3600)") && !unlockCapsule.includes("createSignedUrl(video.video_url"),
  "Time capsule unlock still signs each video separately",
);
assert(!resetCaptains.includes("for (const table of tables"), "Captains reset still performs DB operations per table");
assert(resetCaptains.includes('.in("table_id", tableIds)'), "Captains reset is not batched by table IDs");
assert(
  demoWorker.includes(".limit(1)") && !demoWorker.includes('count: "exact", head: true'),
  "Demo worker still counts every paid event for an existence check",
);

for (const indexName of [
  "events_password_hash_idx",
  "events_admin_password_idx",
  "events_owner_created_at_idx",
  "captains_events_owner_created_at_idx",
  "photos_event_captured_at_idx",
  "videos_event_captured_at_idx",
  "audios_event_captured_at_idx",
]) {
  assert(indexes.includes(indexName), `Required performance index is missing: ${indexName}`);
}

console.log("Final Supabase performance audit passed.");
