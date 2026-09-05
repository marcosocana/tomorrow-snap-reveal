import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [];
const expect = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const app = read("src/App.tsx");
const dashboard = read("src/pages/EventManagement.tsx");
const publicPage = read("src/pages/PhotostripPublic.tsx");
const adminPage = read("src/pages/PhotostripAdmin.tsx");
const generator = read("src/lib/generatePhotostrip.ts");
const api = read("supabase/functions/photostrip-api/index.ts");
const migration = read("supabase/migrations/20260904120000_add_photostrip_product.sql");
const demoMigration = read("supabase/migrations/20260905120000_add_photostrip_demo_limits_and_branding.sql");
const demoFunction = read("supabase/functions/create-photostrip-demo/index.ts");
const demoPage = read("src/pages/NewPhotostripDemo.tsx");
const demoEmail = read("supabase/functions/send-demo-event-email/index.ts");
const styles = read("src/index.css");

for (const route of [
  "/photostrip/:eventSlug",
  "/photostrip/:eventSlug/gallery",
  "/admin/photostrip/new",
  "/admin/photostrip/:eventId",
  "/admin/photostrip/:eventId/edit",
]) expect(`route ${route}`, app.includes(`path="${route}"`));
expect("public Photostrip demo route", app.includes('path="/nuevophotostripdemo"'));

for (const legacyRoute of ["/camera", "/gallery", "/events/:password", "/capsula/:eventId", "/capitanes/:eventSlug"]) {
  expect(`legacy route preserved ${legacyRoute}`, app.includes(`path="${legacyRoute}"`));
}

expect("four dashboard products", ["revelao", "captains", "capsule", "photostrip"].every((value) => dashboard.includes(`value: "${value}"`)));
expect("Photostrip is excluded from Revelao events", dashboard.includes("!isPhotostripEvent(event)"));
expect("anonymous identity uses UUID", publicPage.includes("getPhotostripIdentity") && read("src/lib/photostrip.ts").includes("crypto.randomUUID()"));
expect("camera requested after explicit action", publicPage.includes("onClick={() => event.photoMode") && publicPage.includes("navigator.mediaDevices.getUserMedia"));
expect("automated four-photo sequence", publicPage.includes("index < 4") && publicPage.includes("captured.push(await captureOne())"));
expect("capture finalizes automatically", publicPage.includes("await finalize(captured)") && !publicPage.includes('stage === "preview"'));
expect("Canvas emits WebP", generator.includes('"image/webp"') && generator.includes("photos.length !== 4"));
expect("individual photos resized", generator.includes("const outputWidth = 1400") && generator.includes("const outputHeight = 1050"));
expect("public gallery is paginated", api.includes("Math.min(24") && publicPage.includes("CARGAR MÁS"));
expect("admin gallery is paginated", api.includes("Math.min(60") && adminPage.includes("Cargar más"));
expect("download metrics are server-side", api.includes('action === "download"') && api.includes("download_count"));
expect("unique participation constraint", migration.includes("UNIQUE (event_id, participant_id)"));
expect("private storage bucket", migration.includes("'photostrips',\n  'photostrips',\n  false"));
expect("anonymous SQL access revoked", migration.includes("FROM PUBLIC, anon"));
expect("four uploads finalized transactionally", migration.includes("cardinality(target_photo_paths) <> 4") && api.includes("complete_photostrip_participation"));
expect("Realtime publication enabled", migration.includes("ALTER PUBLICATION supabase_realtime ADD TABLE public.photostrip_participations"));
expect("admin ownership is enforced", api.includes("await canManage(req, event)"));
expect("QR exports PNG and SVG", adminPage.includes("downloadPng") && adminPage.includes("downloadSvg"));
expect("no microphone request", publicPage.includes("audio: false") && !publicPage.includes("getUserMedia({ audio: true"));
expect("demo creation is limited to three strips", demoFunction.includes("max_strips: 3") && demoMigration.includes("PHOTOSTRIP_LIMIT_REACHED"));
expect("demo limit is claimed atomically", api.includes('rpc("claim_photostrip_participation"') && demoMigration.includes("FOR UPDATE"));
expect("regular Photostrips remain unlimited", demoMigration.includes("ADD COLUMN IF NOT EXISTS max_strips integer") && demoMigration.includes("max_strips IS NULL"));
expect("Revelao logo is the default", demoFunction.includes("LogoMiniRevelao.svg") && demoMigration.includes("ALTER COLUMN logo_url SET DEFAULT"));
expect("cover image reaches the public experience", api.includes("coverImageUrl: event.background_image_url") && publicPage.includes("event.coverImageUrl"));
expect("result links to guest gallery", publicPage.includes("VER FOTOS DE OTROS INVITADOS"));
expect("demo wizard creates through protected function", demoPage.includes('invoke("create-photostrip-demo"') && demoPage.includes("3 tiras"));
expect("Photostrip demo skips delayed reveal email", demoMigration.includes("IF NEW.type <> 'photostrip'"));
expect("wrong password offers recovery", demoPage.includes("recupera tu contraseña") && demoPage.includes('href="/reset-password"'));
expect("demo sends confirmation email", demoFunction.includes("sendConfirmation") && demoEmail.includes('eventType === "photostrip"'));
expect("confirmation email opens event editor", demoEmail.includes("/admin/photostrip/${event.id}/edit"));
expect("public experience allows vertical scrolling without horizontal overflow", styles.includes("overflow-x: hidden") && styles.includes("overflow-y: auto") && styles.includes("-webkit-overflow-scrolling: touch"));
expect("camera action says Empezar", publicPage.includes("EMPEZAR") && !publicPage.includes("> START<"));
expect("result exposes download, share and guest gallery", publicPage.includes("photostrip-result-actions") && publicPage.includes("> DESCARGAR</button>") && publicPage.includes("shareOwnStrip") && publicPage.includes("VER FOTOS DE OTROS INVITADOS"));
expect("Photostrip admin uses Revelao-style table", adminPage.includes("PhotostripDashboardEvent") && adminPage.includes("<table") && adminPage.includes('"DEMO"'));
expect("mobile camera waits for a real video frame", publicPage.includes("waitForUsableVideo") && publicPage.includes("HAVE_CURRENT_DATA") && publicPage.includes("video.videoWidth"));
expect("mobile video uses inline autoplay", publicPage.includes("autoPlay playsInline muted"));
expect("mobile camera resumes after browser interruption", publicPage.includes("visibilitychange") && publicPage.includes("pageshow"));
expect("mobile camera offers a direct activation fallback", publicPage.includes("cameraNeedsActivation") && publicPage.includes("ACTIVAR CÁMARA"));
expect("own and gallery strips can be shared", publicPage.includes("shareOwnStrip") && publicPage.includes("shareGalleryItem") && read("src/lib/photostrip.ts").includes("navigator.canShare"));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"}  ${check.name}`);
const failed = checks.filter((check) => !check.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) process.exit(1);
