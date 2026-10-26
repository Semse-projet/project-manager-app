-- T-008 S2a: append-only operational phase-change audit, additive only.
-- Does not provision OPEN or grant a user the ability to transition a gate.
CREATE TABLE "StorageWriteGateAudit" (
  "id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "epochBefore" BIGINT NOT NULL,
  "epochAfter" BIGINT NOT NULL,
  "phaseBefore" TEXT NOT NULL,
  "phaseAfter" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "ticket" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorageWriteGateAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorageWriteGateAudit_scope_fkey" FOREIGN KEY ("scope")
    REFERENCES "StorageWriteGate"("scope") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StorageWriteGateAudit_before_check"
    CHECK ("phaseBefore" IN ('OPEN','DRAINING','FROZEN')),
  CONSTRAINT "StorageWriteGateAudit_after_check"
    CHECK ("phaseAfter" IN ('OPEN','DRAINING','FROZEN')),
  CONSTRAINT "StorageWriteGateAudit_action_check"
    CHECK ("action" IN ('BEGIN_DRAIN','MARK_FROZEN','THAW','ABORT_DRAIN'))
);
CREATE INDEX "StorageWriteGateAudit_scope_occurredAt_idx"
  ON "StorageWriteGateAudit"("scope","occurredAt");
