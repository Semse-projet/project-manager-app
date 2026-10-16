-- T-008 S2: durable, additive storage-write coordination authority.
-- No production writer is wired to these tables by this migration.

CREATE TYPE "StorageWriteGatePhase" AS ENUM ('OPEN', 'DRAINING', 'FROZEN');
CREATE TYPE "StorageWriteOperationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABORTED', 'AMBIGUOUS');

CREATE TABLE "StorageWriteGate" (
    "id" TEXT NOT NULL,
    "environmentKey" TEXT NOT NULL,
    "storageRoot" TEXT NOT NULL,
    "phase" "StorageWriteGatePhase" NOT NULL DEFAULT 'OPEN',
    "writerCoverageComplete" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastTransitionTicket" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageWriteGate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageWriteOperation" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "writerKind" TEXT NOT NULL,
    "status" "StorageWriteOperationStatus" NOT NULL DEFAULT 'ACTIVE',
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "ambiguityReason" TEXT,

    CONSTRAINT "StorageWriteOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageWriteGateTransitionLog" (
    "id" TEXT NOT NULL,
    "gateId" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromPhase" "StorageWriteGatePhase" NOT NULL,
    "toPhase" "StorageWriteGatePhase" NOT NULL,
    "actorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageWriteGateTransitionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageWriteGate_environmentKey_storageRoot_key"
ON "StorageWriteGate"("environmentKey", "storageRoot");

CREATE INDEX "StorageWriteGate_phase_updatedAt_idx"
ON "StorageWriteGate"("phase", "updatedAt");

CREATE UNIQUE INDEX "StorageWriteOperation_gateId_operationKey_key"
ON "StorageWriteOperation"("gateId", "operationKey");

CREATE INDEX "StorageWriteOperation_gateId_status_admittedAt_idx"
ON "StorageWriteOperation"("gateId", "status", "admittedAt");

CREATE INDEX "StorageWriteGateTransitionLog_gateId_createdAt_idx"
ON "StorageWriteGateTransitionLog"("gateId", "createdAt");

CREATE INDEX "StorageWriteGateTransitionLog_ticket_idx"
ON "StorageWriteGateTransitionLog"("ticket");

ALTER TABLE "StorageWriteOperation"
ADD CONSTRAINT "StorageWriteOperation_gateId_fkey"
FOREIGN KEY ("gateId") REFERENCES "StorageWriteGate"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StorageWriteGateTransitionLog"
ADD CONSTRAINT "StorageWriteGateTransitionLog_gateId_fkey"
FOREIGN KEY ("gateId") REFERENCES "StorageWriteGate"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
