import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PurchaseEmailJob, sendPurchaseEmail } from "./purchaseEmail.ts";

const config = {
  resendApiKey: "test-key",
  fromEmail: "Revelao <hola@example.com>",
  logoUrl: "https://example.com/logo.png",
};

const withMockFetch = async (job: PurchaseEmailJob) => {
  const originalFetch = globalThis.fetch;
  let request: Request | null = null;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return Response.json({ id: "email_test_123" });
  };
  try {
    const id = await sendPurchaseEmail(job, config);
    return { id, request: request! };
  } finally {
    globalThis.fetch = originalFetch;
  }
};

Deno.test("Revelao email uses a stable Stripe-session idempotency key", async () => {
  const { id, request } = await withMockFetch({
    id: "job_1",
    stripe_session_id: "cs_test_revelao",
    email_type: "revelao_purchase",
    recipient: "buyer@example.com",
    attempts: 1,
    payload: {
      redeemUrl: "https://acceso.revelao.cam/redeem/CODE123",
      planLabel: "Recuerdos",
      redeemCode: "CODE123",
    },
  });
  const body = await request.json();
  assertEquals(id, "email_test_123");
  assertEquals(request.headers.get("Idempotency-Key"), "stripe-cs_test_revelao-revelao_purchase");
  assertEquals(body.to, ["buyer@example.com"]);
  assertStringIncludes(body.html, "https://acceso.revelao.cam/redeem/CODE123");
});

Deno.test("Captains email contains the purchased configuration and onboarding link", async () => {
  const { request } = await withMockFetch({
    id: "job_2",
    stripe_session_id: "cs_test_captains",
    email_type: "captains_purchase",
    recipient: "captain@example.com",
    attempts: 1,
    payload: {
      onboardingUrl: "https://acceso.revelao.cam/admin-login?redirect=%2Fnuevoeventocapitanes",
      creationCode: "CAPTAIN123",
      tableCount: 12,
      captainPack: true,
      totalAmount: 9900,
      currency: "eur",
    },
  });
  const body = await request.json();
  assertEquals(request.headers.get("Idempotency-Key"), "stripe-cs_test_captains-captains_purchase");
  assertStringIncludes(body.html, "CAPTAIN123");
  assertStringIncludes(body.html, "Mesas:</strong> 12");
  assertStringIncludes(body.html, "Pack Capitán:</strong> Sí");
});
