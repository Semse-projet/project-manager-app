import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException } from "@nestjs/common";
import { PaymentGovernanceService } from "../dist/modules/payments/payment-governance.service.js";

// WS-01C G1 finding (point 19, docs/ws-01c/WS-01C-G1-AS-IS-Reconciliation.md):
// this evaluate() is a SIBLING class to the one fixed for org-scoping in
// modules/payment-governance/ (same name, different module — the exact
// "duplicate writer" risk ADR-040 flags) and had the identical gap: scoped
// only by tenantId, reachable directly via GET
// /v1/milestones/:id/payment-governance (milestones:read, held by
// CLIENT/PRO). `actor` is optional so MilestonesService.approve()'s internal
// auto-release path (already authorized one step earlier in the same
// request) can keep calling it without one — every externally-reachable
// caller now passes one.

const readyReadiness = {
  status: "ready_to_release" as const,
  reasons: [],
  blockers: [],
  nextAction: "Release payment",
  milestone: { status: "approved", paymentReadiness: "ready_to_release", evidenceReadiness: "complete" },
};

const milestoneRecord = {
  id: "ms_1",
  status: "approved",
  paymentReadiness: "ready_to_release",
  evidenceReadiness: "complete",
  amount: 5000,
  project: { id: "project_1", jobId: "job_1", assignedProOrgId: "org_pro", job: { clientOrgId: "org_client" } },
  evidenceItems: [],
};

function actor(orgId: string, roles: string[] = []) {
  return { tenantId: "tenant_1", orgId, userId: "usr_test", roles };
}

function makeService() {
  const milestonesRepo = { computePaymentReadiness: async () => readyReadiness };
  const prisma = {
    milestone: { findFirst: async () => milestoneRecord },
    changeOrderCandidate: { count: async () => 0 },
    operationalSignal: { count: async () => 0 },
  };
  const waiverGate = { authorizeRelease: async () => ({ approved: true }) };
  return new PaymentGovernanceService(prisma as never, milestonesRepo as never, waiverGate as never);
}

test("evaluate() with no actor (internal caller) is unaffected — existing behavior preserved", async () => {
  const service = makeService();
  const result = await service.evaluate("ms_1", "tenant_1");
  assert.equal(result.canRelease, true);
});

test("evaluate() denies an actor from a different org in the same tenant", async () => {
  const service = makeService();
  await assert.rejects(() => service.evaluate("ms_1", "tenant_1", actor("org_other")), ForbiddenException);
});

test("evaluate() allows the client org", async () => {
  const service = makeService();
  const result = await service.evaluate("ms_1", "tenant_1", actor("org_client"));
  assert.equal(result.canRelease, true);
});

test("evaluate() allows the assigned pro org", async () => {
  const service = makeService();
  const result = await service.evaluate("ms_1", "tenant_1", actor("org_pro"));
  assert.equal(result.canRelease, true);
});

test("evaluate() allows OPS_ADMIN regardless of org", async () => {
  const service = makeService();
  const result = await service.evaluate("ms_1", "tenant_1", actor("org_other", ["OPS_ADMIN"]));
  assert.equal(result.canRelease, true);
});
