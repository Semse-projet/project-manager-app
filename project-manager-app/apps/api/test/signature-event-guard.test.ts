import test from "node:test";
import assert from "node:assert/strict";
import { assertSignatureEventBound } from "../dist/modules/contracts/signature-event-guard.js";

const binding = {
  provider: "documenso" as const,
  externalRequestId: "env_123",
  tenantId: "tenant_a",
  contractId: "contract_a",
};
const event = {
  ...binding,
  providerEventId: "evt_123",
  eventType: "envelope.completed",
  verified: true as const,
};

test("verified event binds to exact tenant, contract and request", () => {
  assert.match(assertSignatureEventBound(event, binding), /^[a-f0-9]{64}$/);
});

test("reject cross-tenant event", () => {
  assert.throws(() => assertSignatureEventBound({ ...event, tenantId: "tenant_b" }, binding), /mismatch/);
});

test("reject cross-contract event", () => {
  assert.throws(() => assertSignatureEventBound({ ...event, contractId: "contract_b" }, binding), /mismatch/);
});

test("reject event from different provider request", () => {
  assert.throws(() => assertSignatureEventBound({ ...event, externalRequestId: "env_999" }, binding), /mismatch/);
});

test("reject unverified or incomplete event", () => {
  assert.throws(() => assertSignatureEventBound({ ...event, verified: false as true }, binding), /unverified/);
  assert.throws(() => assertSignatureEventBound({ ...event, providerEventId: "" }, binding), /incomplete/);
});

test("stable replay key for same event; distinct across tenants", () => {
  const first = assertSignatureEventBound(event, binding);
  assert.equal(first, assertSignatureEventBound(event, binding));
  const other = { ...binding, tenantId: "tenant_b" };
  assert.notEqual(first, assertSignatureEventBound({ ...event, tenantId: "tenant_b" }, other));
});
