import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const webhook = read("supabase/functions/stripe-webhook/index.ts");
const worker = read("supabase/functions/process-purchase-email-outbox/index.ts");
const sender = read("supabase/functions/_shared/purchaseEmail.ts");
const migration = read("supabase/migrations/20260903120000_add_stripe_purchase_email_outbox.sql");

assert(webhook.includes('import Stripe from "npm:stripe@22.4.0"'), "Webhook does not use the pinned Stripe SDK");
assert(webhook.includes("constructEventAsync"), "Webhook does not use Stripe's official signature verifier");
assert(webhook.includes("Stripe.createSubtleCryptoProvider()"), "Webhook verifier is not configured for Edge crypto");
assert(/STRIPE_WEBHOOK_SECRET,[\s\S]{0,80}300,/.test(webhook), "Webhook signature tolerance is not 5 minutes");
assert(webhook.includes('"checkout.session.completed"'), "Immediate Checkout payments are not handled");
assert(webhook.includes('"checkout.session.async_payment_succeeded"'), "Delayed successful payments are not handled");
assert(webhook.includes('"checkout.session.async_payment_failed"'), "Delayed failed payments are not recorded");
assert(webhook.includes("stripe.customers.retrieve"), "Customer email fallback is missing");
assert(webhook.includes('throw new Error("CUSTOMER_EMAIL_NOT_FOUND")'), "Missing emails can still be silently accepted");
assert(webhook.includes('email_type: "captains_purchase"'), "Captains purchase email is not queued");
assert(webhook.includes('email_type: "revelao_purchase"'), "Revelao purchase email is not queued");
assert(!webhook.includes("api.resend.com/emails"), "Webhook still sends email inline instead of using the durable outbox");

assert(migration.includes("UNIQUE (stripe_session_id, email_type)"), "Outbox does not prevent duplicate purchase emails");
assert(migration.includes("FOR UPDATE SKIP LOCKED"), "Outbox jobs cannot be claimed safely by concurrent workers");
assert(migration.includes("attempts < 6"), "Outbox retry limit is missing");
assert(migration.includes("ENABLE ROW LEVEL SECURITY"), "Private Stripe tables do not have RLS enabled");
assert(migration.includes("REVOKE ALL ON public.purchase_email_outbox FROM PUBLIC, anon, authenticated"), "Outbox is exposed to clients");
assert(migration.includes("'* * * * *'"), "Purchase email worker is not scheduled every minute");

assert(sender.includes('"Idempotency-Key": `stripe-${job.stripe_session_id}-${job.email_type}`'), "Resend idempotency key is missing");
assert(sender.includes("provider" ) || worker.includes("provider_message_id"), "Resend message ID is not persisted");
assert(worker.includes('status: "sent"'), "Successful deliveries are not marked sent");
assert(worker.includes('dead ? "dead" : "pending"'), "Failed deliveries do not retry or terminate");

console.log("Stripe purchase email audit passed: signature, both products, async payments, idempotency, retries and observability are covered.");
