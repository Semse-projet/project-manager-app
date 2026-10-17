-- T-008 S4a: staging control-plane metadata.
-- Additive only. Does not enable SEMSE_STORAGE_WRITE_GATE_MODE or provision a gate.
ALTER TABLE "StorageWriteGate"
  ADD COLUMN IF NOT EXISTS "recoveryWindowDigest" TEXT;

ALTER TABLE "StorageWriteGateAudit"
  ADD COLUMN IF NOT EXISTS "reason" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "requestDigest" TEXT,
  ADD COLUMN IF NOT EXISTS "targetOperationId" UUID,
  ADD COLUMN IF NOT EXISTS "detailDigest" TEXT;

ALTER TABLE "StorageWriteGateAudit"
  DROP CONSTRAINT IF EXISTS "StorageWriteGateAudit_action_check";

ALTER TABLE "StorageWriteGateAudit"
  ADD CONSTRAINT "StorageWriteGateAudit_action_check"
  CHECK ("action" IN (
    'BEGIN_DRAIN','MARK_FROZEN','THAW','ABORT_DRAIN',
    'PROVISION','ATTEST_COVERAGE','ATTEST_WINDOW_CLOSED','RECOVER_OPERATION'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS "StorageWriteGateAudit_scope_idempotency_uniq"
  ON "StorageWriteGateAudit"("scope","idempotencyKey");

ALTER TABLE "StorageWriteOperation"
  DROP CONSTRAINT IF EXISTS "StorageWriteOperation_state_check";

ALTER TABLE "StorageWriteOperation"
  ADD CONSTRAINT "StorageWriteOperation_state_check"
  CHECK ("state" IN ('ACTIVE','COMPLETED','FAILED_CLEAN','RECOVERED_FENCED'));
