import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import { PaymentGovernanceService } from "../dist/modules/payment-governance/payment-governance.service.js";

// D02 mitigation (2026-09-14, SEMSE_EXECUTION_LEDGER.md Blockers): releasePayment()
// used to create a payment transaction row and report success WITHOUT ever
// calling Stripe/EscrowReleaseService — the only path that actually moves
// money. An admin using the "Liberar escrow" button was told funds were
// released when they were not. Disabled here (fails loudly instead of
// fabricating success) until the real milestone-resolution design lands —
// see tests/unit/payment-release-canonical-path.test.mjs for the still-open
// canonical-path golden regression this does not yet close.

const ESCROW = { id: "escrow_1", projectId: "proj_1", status: "PENDING_SETTLEMENT", tenantId: "tnt_owner" };

function makeService() {
  const repo = {
    async getEscrow(escrowId: string, tenantId: string) {
      if (escrowId !== ESCROW.id || tenantId !== ESCROW.tenantId) return null;
      return { id: ESCROW.id, projectId: ESCROW.projectId, status: ESCROW.status, transactions: [], project: { id: ESCROW.projectId, tenantId } };
    },
    async createPaymentTransaction() {
      throw new Error("createPaymentTransaction must not be called while release is disabled");
    },
    async logPaymentDecision() {
      throw new Error("logPaymentDecision must not be called while release is disabled");
    },
  } as never;
  const diagnostics = {} as never;
  return new PaymentGovernanceService(repo, diagnostics);
}

test("releasePayment on the owning tenant's escrow fails safe instead of fabricating success", async () => {
  const service = makeService();

  await assert.rejects(
    () => service.releasePayment({
      escrowId: "escrow_1", milestoneId: "ms_1", amount: 1000, reason: "milestone complete",
      releasedBy: "usr_admin", tenantId: "tnt_owner",
    }),
    ServiceUnavailableException,
  );
});
