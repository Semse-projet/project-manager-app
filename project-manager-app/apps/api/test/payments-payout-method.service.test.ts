import test from "node:test";
import assert from "node:assert/strict";
import { PaymentsService } from "../dist/modules/payments/payments.service.js";

// 2.44 — saveWorkerPayoutMethod no longer accepts a raw routingNumber/
// accountNumber/card number. It receives a Stripe token (created client-side
// via stripe.createToken(), browser → Stripe directly) and, when Stripe is
// really configured, verifies that token server-side to get the authoritative
// last4 instead of trusting whatever the browser claims.

function createService(overrides: { verifyPayoutToken?: (token: string) => Promise<string | undefined> } = {}) {
  const appended: Array<{ body: string }> = [];
  const workspaceMemory = {
    async append(record: { body: string }) {
      appended.push(record);
      return record;
    },
  };
  const auditService = { async append() { /* no-op */ } };
  const stripeConnect = overrides.verifyPayoutToken
    ? { verifyPayoutToken: overrides.verifyPayoutToken }
    : undefined;

  const service = new PaymentsService(
    {} as never, // paymentsRepository — unused by saveWorkerPayoutMethod
    auditService as never,
    {} as never, // paymentProviderRegistry
    {} as never, // projectsService
    {} as never, // contractsRepository
    {} as never, // reservationsRepository
    workspaceMemory as never,
    undefined,   // sse
    stripeConnect as never,
  );
  return { service, appended };
}

void test("saveWorkerPayoutMethod trusts Stripe's own last4 over whatever the client sent", async () => {
  const { service, appended } = createService({
    verifyPayoutToken: async () => "4242",
  });

  await service.saveWorkerPayoutMethod({
    tenantId: "tnt", orgId: "org", userId: "usr", requestId: "req_1",
    type: "debit_card", stripeToken: "tok_visa", last4: "0000",
  });

  const saved = JSON.parse(appended[0].body) as { last4?: string };
  assert.equal(saved.last4, "4242", "should prefer Stripe's verified last4, not the client-sent one");
});

void test("saveWorkerPayoutMethod falls back to the client-sent last4 when Stripe isn't configured", async () => {
  const { service, appended } = createService({
    verifyPayoutToken: async () => undefined, // Stripe not configured (mock mode)
  });

  await service.saveWorkerPayoutMethod({
    tenantId: "tnt", orgId: "org", userId: "usr", requestId: "req_2",
    type: "bank_account", stripeToken: "tok_bank", last4: "6789", bankName: "Chase",
  });

  const saved = JSON.parse(appended[0].body) as { last4?: string };
  assert.equal(saved.last4, "6789");
});

void test("saveWorkerPayoutMethod never calls Stripe verification for digital wallet types", async () => {
  let calls = 0;
  const { service, appended } = createService({
    verifyPayoutToken: async () => { calls++; return "9999"; },
  });

  await service.saveWorkerPayoutMethod({
    tenantId: "tnt", orgId: "org", userId: "usr", requestId: "req_3",
    type: "paypal", email: "pro@example.com",
  });

  assert.equal(calls, 0);
  const saved = JSON.parse(appended[0].body) as { email?: string; last4?: string };
  assert.equal(saved.email, "pro@example.com");
  assert.equal(saved.last4, undefined);
});

void test("saveWorkerPayoutMethod works when StripeConnectService isn't injected at all (no Stripe module)", async () => {
  const { service, appended } = createService();

  await service.saveWorkerPayoutMethod({
    tenantId: "tnt", orgId: "org", userId: "usr", requestId: "req_4",
    type: "debit_card", stripeToken: "tok_visa", last4: "1111",
  });

  const saved = JSON.parse(appended[0].body) as { last4?: string };
  assert.equal(saved.last4, "1111");
});
