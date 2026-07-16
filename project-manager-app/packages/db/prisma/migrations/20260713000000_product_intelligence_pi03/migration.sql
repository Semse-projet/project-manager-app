-- CreateEnum
CREATE TYPE "ProductConsentClass" AS ENUM ('ESSENTIAL', 'STANDARD', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "FrictionKind" AS ENUM ('RAGE_CLICK', 'NAV_LOOP', 'FORM_ABANDON', 'ERROR_REPEAT');

-- CreateTable
CREATE TABLE "ProductSession" (
    "sessionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "userId" TEXT,
    "device" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "propsJson" JSONB,
    "ts" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductIngestBatch" (
    "batchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "acceptedCount" INTEGER NOT NULL,
    "consentClass" "ProductConsentClass" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductIngestBatch_pkey" PRIMARY KEY ("batchId")
);

-- CreateTable
CREATE TABLE "FrictionSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "FrictionKind" NOT NULL,
    "route" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "evidenceJson" JSONB NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrictionSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "consentClass" "ProductConsentClass" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSession_tenantId_lastSeen_idx" ON "ProductSession"("tenantId", "lastSeen");

-- CreateIndex
CREATE INDEX "ProductSession_anonymousId_idx" ON "ProductSession"("anonymousId");

-- CreateIndex
CREATE INDEX "ProductEvent_tenantId_name_ts_idx" ON "ProductEvent"("tenantId", "name", "ts");

-- CreateIndex
CREATE INDEX "ProductEvent_sessionId_ts_idx" ON "ProductEvent"("sessionId", "ts");

-- CreateIndex
CREATE INDEX "ProductEvent_createdAt_idx" ON "ProductEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ProductIngestBatch_tenantId_receivedAt_idx" ON "ProductIngestBatch"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "ProductIngestBatch_receivedAt_idx" ON "ProductIngestBatch"("receivedAt");

-- CreateIndex
CREATE INDEX "FrictionSignal_tenantId_kind_createdAt_idx" ON "FrictionSignal"("tenantId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "FrictionSignal_createdAt_idx" ON "FrictionSignal"("createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_tenantId_anonymousId_grantedAt_idx" ON "ConsentRecord"("tenantId", "anonymousId", "grantedAt");

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ProductSession"("sessionId") ON DELETE CASCADE ON UPDATE CASCADE;

