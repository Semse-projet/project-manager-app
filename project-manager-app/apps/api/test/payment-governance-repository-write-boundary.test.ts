import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import { PaymentGovernanceRepository } from "../dist/modules/payment-governance/payment-governance.repository.js";

// #827 / D02 regression: the legacy repository must never create or mark
// a RELEASE without the verified contract reservation and provider outcome.
// All real commands reserve through PaymentsRepository.releaseFunds().
function legacyRepository() {
  const attemptedWrites: string[] = [];
  const prisma = {
    paymentTxn: {
      async create() {
        attemptedWrites.push("create");
        throw new Error("UNSAFE_DIRECT_RELEASE_CREATE");
      },
      async update() {
        attemptedWrites.push("update");
        throw new Error("UNSAFE_DIRECT_STATUS_UPDATE");
      },
    },
  };
  return { repository: new PaymentGovernanceRepository(prisma as never), attemptedWrites };
}

test("legacy direct release writer fails closed before any Prisma create", async () => {
  const { repository, attemptedWrites } = legacyRepository();
  await assert.rejects(
    () => repository.createPaymentTransaction({
      escrowId: "escrow_test", milestoneId: "milestone_test",
      tenantId: "tenant_test", amount: 125, reason: "completed", releasedBy: "user_test",
    }),
    ServiceUnavailableException,
  );
  assert.deepEqual(attemptedWrites, []);
});

test("legacy transaction status updater cannot fabricate SUCCEEDED or PENDING", async () => {
  const { repository, attemptedWrites } = legacyRepository();
  for (const status of ["SUCCEEDED", "PENDING"] as const) {
    await assert.rejects(
      () => repository.updatePaymentTransactionStatus("txn_legacy", status),
      ServiceUnavailableException,
    );
  }
  assert.deepEqual(attemptedWrites, []);
});
