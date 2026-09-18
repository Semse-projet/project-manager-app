import test from "node:test";
import assert from "node:assert/strict";
import "reflect-metadata";
import { SseController } from "../dist/infrastructure/sse/sse.controller.js";
import { IS_PUBLIC_KEY } from "../dist/common/public.decorator.js";

// WS-01C G1 finding (point 24, docs/ws-01c/WS-01C-G1-AS-IS-Reconciliation.md):
// planStream/delegationsStream/contextStream/financeStream/buildopsStream used
// to be @Public() and trust a client-supplied `x-tenant-id` header as their
// only tenant signal — reachable directly against the public API, not just
// through the authenticated web BFF. Any unauthenticated caller could set
// that header to any tenant's id and receive that tenant's real-time events.
// Fixed to match missionControlStream's already-correct pattern: no
// @Public(), tenantId comes from the verified authContext the global
// AuthGuard attaches (resolveRequestContext), never from a raw header.

function makeBus() {
  const channels: Record<string, unknown[]> = {};
  return {
    on: () => ({ pipe: () => ({ subscribe() { /* no-op for these tests */ } }) }),
    onPrefix: () => ({ pipe: () => ({ subscribe() { /* no-op */ } }) }),
    _channels: channels,
  } as never;
}

function makeController() {
  const plans = { findById: async () => null } as never;
  const delegations = { listByProject: async () => [] } as never;
  const prisma = { project: { findFirst: async () => null } } as never;
  const health = { getHealth: () => ({ status: "ok" }) } as never;
  return new SseController(makeBus(), health, plans, delegations, prisma);
}

test("financeStream is no longer @Public() — the global AuthGuard now runs for it", () => {
  const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, SseController.prototype.financeStream);
  assert.notEqual(isPublic, true);
});

test("buildopsStream, contextStream, planStream, delegationsStream are no longer @Public()", () => {
  for (const name of ["buildopsStream", "contextStream", "planStream", "delegationsStream"] as const) {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, (SseController.prototype as never as Record<string, unknown>)[name]);
    assert.notEqual(isPublic, true, `${name} should not be @Public() anymore`);
  }
});

test("healthStream and agentsStream remain @Public() — global, non-tenant-scoped feeds, unaffected by this fix", () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, SseController.prototype.healthStream), true);
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, SseController.prototype.agentsStream), true);
});

test("financeStream derives its channel from the verified authContext, never from a client-supplied header", async () => {
  const controller = makeController();

  // Simulates the request AFTER the global AuthGuard has run and attached a
  // verified authContext for tenant "tnt_real" — while an attacker-controlled
  // x-tenant-id header (as would arrive on the wire) claims a different tenant.
  const req = {
    headers: { "x-tenant-id": "tnt_attacker" },
    authContext: { tenantId: "tnt_real", orgId: "org_real", userId: "usr_real", roles: [] as string[] },
  };

  // financeStream builds its bus channel synchronously before subscribing —
  // capture it by overriding `on` on a fresh bus instance for this call.
  let capturedChannel: string | undefined;
  const bus = {
    on: (channel: string) => {
      capturedChannel = channel;
      return { pipe: () => ({ subscribe() { /* no-op */ } }) };
    },
  } as never;
  const plans = {} as never;
  const delegations = {} as never;
  const prisma = {} as never;
  const health = {} as never;
  const isolatedController = new SseController(bus, health, plans, delegations, prisma);

  isolatedController.financeStream(req as never);

  assert.equal(capturedChannel, "finance:tnt_real");
  assert.notEqual(capturedChannel, "finance:tnt_attacker");
});

test("financeStream throws (via resolveRequestContext) when no authContext and AUTH_SECRET requires a real token", () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-secret-for-this-assertion-only";
  try {
    const controller = makeController();
    const reqWithOnlyASpoofedHeader = { headers: { "x-tenant-id": "tnt_attacker" } };
    assert.throws(() => controller.financeStream(reqWithOnlyASpoofedHeader as never));
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});
