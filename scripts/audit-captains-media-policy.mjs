import fs from "node:fs";
import assert from "node:assert/strict";

const capture = fs.readFileSync("src/components/captains-v2/MediaCapture.tsx", "utf8");
const service = fs.readFileSync("src/lib/captainsService.ts", "utf8");
const admin = fs.readFileSync("src/pages/CaptainsAdmin.tsx", "utf8");

assert.doesNotMatch(capture, /type=["']file["']/i, "Capitanes v2 must not expose file attachments");
assert.match(capture, /getUserMedia/);
assert.match(capture, /MAX_VIDEO_SECONDS = 30/);
assert.match(capture, /MAX_VIDEO_BYTES = 25 \* 1024 \* 1024/);
assert.match(capture, /width: \{ ideal: 1280 \}, height: \{ ideal: 720 \}/);
assert.match(capture, /videoBitsPerSecond: VIDEO_BITS_PER_SECOND/);
assert.match(capture, /PHOTO_MAX_DIMENSION = 1600/);
assert.match(service, /let thumbnailPath = thumbnail/);
assert.match(service, /evidence\.evidence_type === "photo" && !match\?\.\[3\]\.startsWith\("capitanes-"\)/);
assert.match(admin, /<EvidencePreview evidence=\{item\} compact \/>/);
assert.match(admin, /queryKey: \["captains", "evidence-index", eventId\][\s\S]*?enabled: Boolean\(eventId\)/);
assert.match(admin, /h-32 w-full rounded-xl bg-\[#211d1e\] object-contain/);
assert.doesNotMatch(admin, /<DeferredVideo/);
assert.match(admin, /<video src=\{url\} controls playsInline preload="metadata"/);

console.log("PASS: capture-only media, 30 s/25 MB video guard, reduced camera output and uniform lazy admin thumbnails.");
