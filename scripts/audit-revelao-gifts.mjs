import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const management = read("src/pages/EventManagement.tsx");
const redeemPage = read("src/pages/RedeemEvent.tsx");
const giftFunction = read("supabase/functions/admin-gift-revelao/index.ts");
const redeemGet = read("supabase/functions/redeem-get/index.ts");
const redeemCreate = read("supabase/functions/redeem-create-event/index.ts");
const migration = read("supabase/migrations/20260804120000_add_revelao_gifts.sql");
const config = read("supabase/config.toml");

assert.match(management, /Regalar Revelao/);
assert.match(management, /generateGiftPassword[\s\S]*Uint8Array\(8\)/);
assert.match(management, /Esta cuenta ya existe[\s\S]*contraseña anterior/);
assert.match(management, /Cancelar[\s\S]*Continuar/);
assert.match(management, /functions\.invoke\("admin-gift-revelao"/);
assert.match(giftFunction, /ADMIN_EMAIL = "revelao\.cam@gmail\.com"/);
assert.match(giftFunction, /requiresConfirmation: true, existingAccount: true/);
assert.match(giftFunction, /auth\.admin\.createUser\([\s\S]*email_confirm: true/);
assert.match(giftFunction, /from\("purchases"\)[\s\S]*gifted_at[\s\S]*gift_recipient_name/);
assert.match(giftFunction, /sendGiftEmail[\s\S]*api\.resend\.com\/emails/);
assert.match(migration, /gifted_at[\s\S]*gift_recipient_name/);
assert.match(config, /\[functions\.admin-gift-revelao\]/);
assert.match(redeemGet, /isGift: Boolean\(data\.gifted_at\)/);
assert.match(redeemPage, /data\?\.isGift[\s\S]*admin-login\?redirect=/);
assert.match(redeemCreate, /GIFT_ACCOUNT_MISMATCH/);
assert.match(redeemCreate, /GIFT_LOGIN_REQUIRED/);
assert.match(redeemCreate, /owner_id: ownerId/);

console.log("Revelao gift audit passed (17 checks).");
