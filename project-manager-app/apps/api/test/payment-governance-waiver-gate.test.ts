import test from "node:test";
import assert from "node:assert/strict";

import { PaymentGovernanceService } from "../dist/modules/payments/payment-governance.service.js";

/**
 * Tests that PaymentGovernanceService actually consults WaiverPaymentGateService
 * before allowing an escrow release. WaiverPaymentGateService existed as
 * correct, tested code but was never registered as a provider anywhere and
 * was never called from the real release path (EscrowReleaseService ->
 * PaymentGovernanceService.evaluate()) — this closes that gap.
 */

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
  project: { id: "project_1", jobId: "job_1" },
  evidenceItems: [],
};

function makeService(opts: { waiverApproved: boolean; waiverReason?: string }) {
  const milestonesRepo = { computePaymentReadiness: async () => readyReadiness };
  const prisma = {
    milestone: { findFirst: async () => milestoneRecord },
    changeOrderCandidate: { count: async () => 0 },
    operationalSignal: { count: async () => 0 },
  };
  const waiverGate = {
    authorizeRelease: async (projectId: string, releaseAmount: number) => {
      assert.equal(projectId, "project_1");
      assert.equal(releaseAmount, 5000);
      return opts.waiverApproved
        ? { approved: true }
        : { approved: false, reason: opts.waiverReason ?? "Waiver requirements not met" };
    },
  };

  return new PaymentGovernanceService(prisma as never, milestonesRepo as never, waiverGate as never);
}

test("evaluate() blocks release when the lien waiver gate does not approve", async () => {
  const service = makeService({
    waiverApproved: false,
    waiverReason: "Lien waiver required (California) before release. Deadline: 2026-09-01. Waiver: waiver_1",
  });

  const result = await service.evaluate("ms_1", "tenant_1");

  assert.equal(result.canRelease, false);
  assert.equal(result.releaseStatus, "needs_review");
  assert.equal(result.riskLevel, "high");
  assert.ok(result.blockers.some((b: string) => b.includes("Lien waiver required")));
  assert.ok(result.requiredActions.some((a: string) => a.includes("lien waiver")));
  assert.equal(result.nextBestAction, "Lien waiver required (California) before release. Deadline: 2026-09-01. Waiver: waiver_1");
});

test("evaluate() allows release when the lien waiver gate approves and nothing else blocks", async () => {
  const service = makeService({ waiverApproved: true });

  const result = await service.evaluate("ms_1", "tenant_1");

  assert.equal(result.canRelease, true);
  assert.equal(result.releaseStatus, "ready");
  assert.equal(result.blockers.length, 0);
});
