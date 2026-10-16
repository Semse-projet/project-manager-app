-- T-008 S1b: durable write admission ledger. ADDITIVE ONLY.
-- No gate row is initialized: missing authority must fail closed, and
-- production writers are NOT connected in this slice.
CREATE TABLE "StorageWriteGate" (
  "scope" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'OPEN',
  "epoch" BIGINT NOT NULL DEFAULT 1,
  "coverageDigest" TEXT,
  "operatorTicket" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorageWriteGate_pkey" PRIMARY KEY ("scope"),
  CONSTRAINT "StorageWriteGate_phase_check"
    CHECK ("phase" IN ('OPEN', 'DRAINING', 'FROZEN')),
  CONSTRAINT "StorageWriteGate_epoch_check" CHECK ("epoch" > 0)
);

CREATE TABLE "StorageWriteOperation" (
  "id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "epoch" BIGINT NOT NULL,
  "kind" TEXT NOT NULL,
  "writerInstanceId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "StorageWriteOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorageWriteOperation_state_check"
    CHECK ("state" IN ('ACTIVE', 'COMPLETED', 'FAILED_CLEAN')),
  CONSTRAINT "StorageWriteOperation_finished_check"
    CHECK (("state" = 'ACTIVE' AND "finishedAt" IS NULL)
      OR ("state" <> 'ACTIVE' AND "finishedAt" IS NOT NULL)),
  CONSTRAINT "StorageWriteOperation_epoch_check" CHECK ("epoch" > 0),
  CONSTRAINT "StorageWriteOperation_scope_fkey"
    FOREIGN KEY ("scope") REFERENCES "StorageWriteGate"("scope")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StorageWriteOperation_scope_state_idx"
  ON "StorageWriteOperation"("scope", "state");
CREATE INDEX "StorageWriteOperation_scope_epoch_idx"
  ON "StorageWriteOperation"("scope", "epoch");
-- No DELETE, update of existing original, bootstrap to OPEN, or automatic
-- transition to FROZEN occurs in this migration.
