import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const wizard = read("src/pages/PublicDemoEventWizard.tsx");
const summary = read("src/pages/DemoEventSummary.tsx");
const login = read("src/pages/AdminLogin.tsx");
const createFunction = read("supabase/functions/create-demo-event/index.ts");
const emailFunction = read("supabase/functions/send-demo-event-email/index.ts");
const googleOAuth = read("src/lib/googleOAuth.ts");
const oauthCallback = read("src/pages/OAuthCallback.tsx");

assert.match(wizard, /adminPassword: generateAlphanumericPassword\(8\)/);
assert.match(wizard, /functions\.invoke\("create-demo-event"/);
assert.match(wizard, /const normalizedContactEmail = formData\.contactEmail\.trim\(\)\.toLowerCase\(\)/);
assert.match(wizard, /contactEmail: normalizedContactEmail/);
assert.match(createFunction, /auth\.admin\.createUser\([\s\S]*email_confirm: true/);
assert.match(createFunction, /owner_id: userId/);
assert.match(createFunction, /existingAuthUser\?\.id \|\| null/);
assert.doesNotMatch(createFunction, /return json\(\{ error: "EMAIL_EXISTS" \}, 409\)/);
assert.match(createFunction, /firstDemo\?\.admin_password\?\.trim\(\)/);
assert.match(summary, /Datos para gestionar tu evento[\s\S]*Usuario[\s\S]*credentialEmail[\s\S]*Contraseña[\s\S]*event\.admin_password[\s\S]*Gestionar evento/);
assert.match(emailFunction, /isDemo[\s\S]*credentialsTitle[\s\S]*credentialEmail[\s\S]*event\.admin_password[\s\S]*manageButton/);
assert.match(login, /if \(prefEmail\)[\s\S]*setEmail\(prefEmail\)/);
assert.match(wizard, /passwordConfirm/);
assert.match(wizard, /formData\.password\.length >= 8[\s\S]*formData\.password === formData\.passwordConfirm/);
assert.match(wizard, /GoogleSignInButton/);
assert.match(wizard, /const steps[\s\S]*\{ id: "contact", label: "Acceso" \}[\s\S]*\{ id: "name", label: "Evento" \}/);
assert.match(wizard, /stepIndex === steps\.length - 1[\s\S]*handleSubmit\(\)/);
assert.match(wizard, /signInWithGooglePopup[\s\S]*setStepIndex\(1\)/);
assert.match(login, /GoogleSignInButton/);
assert.match(createFunction, /signInWithPassword\([\s\S]*INVALID_CREDENTIALS/);
assert.match(emailFunction, /authMethod[\s\S]*usesGoogle/);
assert.match(googleOAuth, /provider: "google"[\s\S]*skipBrowserRedirect: true/);
assert.match(oauthCallback, /GOOGLE_OAUTH_MESSAGE[\s\S]*window\.opener\.postMessage/);

console.log("Demo event credentials audit passed (23 checks).");
