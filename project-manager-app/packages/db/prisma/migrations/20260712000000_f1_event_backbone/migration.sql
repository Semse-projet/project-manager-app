-- CreateEnum
CREATE TYPE "DomainOutboxStatus" AS ENUM ('PENDING', 'CLAIMED', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "DomainConsumptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "DomainOutboxEvent" (
    "eventId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "envelopeVersion" INTEGER NOT NULL DEFAULT 2,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "causationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "schemaRef" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "metadataJson" JSONB,
    "traceContextJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DomainOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "replayCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DomainOutboxEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "DomainEventConsumption" (
    "id" TEXT NOT NULL,
    "eventId" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "consumerName" TEXT NOT NULL,
    "status" "DomainConsumptionStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "resultJson" JSONB,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainEventConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainOutboxEvent_tenantId_idempotencyKey_key" ON "DomainOutboxEvent"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_status_nextAttemptAt_recordedAt_idx" ON "DomainOutboxEvent"("status", "nextAttemptAt", "recordedAt");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_tenantId_correlationId_recordedAt_idx" ON "DomainOutboxEvent"("tenantId", "correlationId", "recordedAt");

-- CreateIndex
CREATE INDEX "DomainOutboxEvent_entityType_entityId_occurredAt_idx" ON "DomainOutboxEvent"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEventConsumption_eventId_consumerName_key" ON "DomainEventConsumption"("eventId", "consumerName");

-- CreateIndex
CREATE INDEX "DomainEventConsumption_tenantId_status_nextAttemptAt_idx" ON "DomainEventConsumption"("tenantId", "status", "nextAttemptAt");

-- AddForeignKey
ALTER TABLE "DomainOutboxEvent" ADD CONSTRAINT "DomainOutboxEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEventConsumption" ADD CONSTRAINT "DomainEventConsumption_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DomainOutboxEvent"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEventConsumption" ADD CONSTRAINT "DomainEventConsumption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
