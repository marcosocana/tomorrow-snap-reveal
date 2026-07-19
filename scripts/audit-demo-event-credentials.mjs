import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const wizard = read("src/pages/PublicDemoEventWizard.tsx");
const summary = read("src/pages/DemoEventSummary.tsx");
const login = read("src/pages/AdminLogin.tsx");
const createFunction = read("supabase/functions/create-demo-event/index.ts");
const emailFunction = read("supabase/functions/send-demo-event-email/index.ts");

assert.match(wizard, /adminPassword: generateAlphanumericPassword\(8\)/);
assert.match(wizard, /functions\.invoke\("create-demo-event"/);
assert.match(wizard, /contactEmail: formData\.contactEmail\.trim\(\)\.toLowerCase\(\)/);
assert.match(createFunction, /auth\.admin\.createUser\([\s\S]*email_confirm: true/);
assert.match(createFunction, /owner_id: userId/);
assert.match(createFunction, /return json\(\{ error: "EMAIL_EXISTS" \}, 409\)/);
assert.match(summary, /Datos para gestionar tu evento[\s\S]*Usuario[\s\S]*credentialEmail[\s\S]*Contraseña[\s\S]*event\.admin_password[\s\S]*Gestionar evento/);
assert.match(emailFunction, /isDemo[\s\S]*credentialsTitle[\s\S]*credentialEmail[\s\S]*event\.admin_password[\s\S]*manageButton/);
assert.match(login, /if \(prefEmail\)[\s\S]*setEmail\(prefEmail\)/);

console.log("Demo event credentials audit passed (9 checks).");
