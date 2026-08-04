import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const wizard = read("src/pages/PublicDemoEventWizard.tsx");
const summary = read("src/pages/DemoEventSummary.tsx");
const login = read("src/pages/AdminLogin.tsx");
const createFunction = read("supabase/functions/create-demo-event/index.ts");
const emailFunction = read("supabase/functions/send-demo-event-email/index.ts");
const app = read("src/App.tsx");

assert.match(wizard, /functions\.invoke\("create-demo-event"/);
assert.match(wizard, /const normalizedContactEmail = formData\.contactEmail\.trim\(\)\.toLowerCase\(\)/);
assert.match(wizard, /contactEmail: normalizedContactEmail/);
assert.match(createFunction, /auth\.admin\.createUser\([\s\S]*email_confirm: true/);
assert.match(createFunction, /owner_id: userId/);
assert.match(createFunction, /existingAuthUser\?\.id \|\| null/);
assert.doesNotMatch(createFunction, /return json\(\{ error: "EMAIL_EXISTS" \}, 409\)/);
assert.match(summary, /Datos para gestionar tu evento[\s\S]*Usuario[\s\S]*credentialEmail[\s\S]*Contraseña[\s\S]*event\.admin_password[\s\S]*Gestionar evento/);
assert.match(emailFunction, /isDemo[\s\S]*credentialsTitle[\s\S]*credentialEmail[\s\S]*event\.admin_password[\s\S]*manageButton/);
assert.match(login, /if \(prefEmail\)[\s\S]*setEmail\(prefEmail\)/);
assert.match(wizard, /passwordConfirm/);
assert.match(wizard, /formData\.password\.length >= 8[\s\S]*formData\.password === formData\.passwordConfirm/);
assert.match(wizard, /const steps[\s\S]*\{ id: "style", label: "Estilo" \}[\s\S]*\{ id: "contact", label: "Contacto" \}/);
assert.match(wizard, /stepIndex === steps\.length - 1[\s\S]*handleSubmit\(\)/);
assert.match(createFunction, /signInWithPassword\([\s\S]*INVALID_CREDENTIALS/);
assert.doesNotMatch(wizard, /GoogleSignInButton|signInWithGoogle/);
assert.doesNotMatch(login, /GoogleSignInButton|signInWithGoogle/);
assert.doesNotMatch(createFunction, /useAuthenticatedUser/);
assert.doesNotMatch(emailFunction, /authMethod|usesGoogle/);
assert.doesNotMatch(app, /OAuthCallback|\/auth\/callback/);

console.log("Demo event credentials audit passed (20 checks).");
