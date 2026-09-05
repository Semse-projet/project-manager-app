-- SEMSE OS capability control plane (F4).
-- Additive only: this migration does not alter or backfill existing tables.

-- CreateEnum
CREATE TYPE "CapabilityDefinitionStatus" AS ENUM ('ACTIVE', 'DEPRECATED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CapabilityActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CapabilityRuntimeTargetKind" AS ENUM ('COMPOSE', 'RAILWAY', 'KUBERNETES');

-- CreateEnum
CREATE TYPE "CapabilityRuntimeTargetStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DEGRADED');

-- CreateEnum
CREATE TYPE "CapabilityDesiredState" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CapabilityObservedState" AS ENUM (
    'PENDING',
    'PLANNED',
    'AWAITING_APPROVAL',
    'APPLYING',
    'VERIFYING',
    'ACTIVE',
    'DEGRADED',
    'SUSPENDING',
    'SUSPENDED',
    'ROLLING_BACK',
    'ROLLED_BACK',
    'BLOCKED'
);

-- CreateEnum
CREATE TYPE "CapabilityOperationIntent" AS ENUM ('ACTIVATE', 'UPDATE', 'SUSPEND', 'ROLLBACK', 'RECONCILE');

-- CreateEnum
CREATE TYPE "CapabilityRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CapabilityApprovalMode" AS ENUM ('SINGLE', 'DUAL');

-- CreateEnum
CREATE TYPE "CapabilityApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CapabilityReceiptStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'TIMED_OUT', 'CANCELLED');

-- CreateTable
CREATE TABLE "CapabilityDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "status" "CapabilityDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapabilityDefinition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CapabilityDefinition_manifestDigest_check" CHECK ("manifestDigest" ~ '^[0-9a-f]{64}$')
);

-- CreateTable
CREATE TABLE "CapabilityRuntimeTarget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "CapabilityRuntimeTargetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "configRef" TEXT NOT NULL,
    "status" "CapabilityRuntimeTargetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapabilityRuntimeTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapabilityInstallation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "capabilityName" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "runtimeTargetId" TEXT NOT NULL,
    "desiredState" "CapabilityDesiredState" NOT NULL DEFAULT 'ACTIVE',
    "observedState" "CapabilityObservedState" NOT NULL DEFAULT 'PENDING',
    "desiredVersion" TEXT NOT NULL,
    "resolvedVersion" TEXT,
    "configurationRevision" INTEGER NOT NULL DEFAULT 1,
    "lastOperationId" TEXT,
    "observedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapabilityInstallation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CapabilityInstallation_configurationRevision_check" CHECK ("configurationRevision" >= 1)
);

-- CreateTable
CREATE TABLE "CapabilityOperation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "runtimeTargetId" TEXT NOT NULL,
    "intent" "CapabilityOperationIntent" NOT NULL,
    "status" "CapabilityObservedState" NOT NULL DEFAULT 'PENDING',
    "risk" "CapabilityRisk" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "policyDecisionJson" JSONB NOT NULL,
    "planJson" JSONB NOT NULL,
    "planDigest" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "requestedByType" "CapabilityActorType" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "configurationRevision" INTEGER NOT NULL,
    "observationJson" JSONB,
    "observedAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMPTZ(3),
    "lockExpiresAt" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapabilityOperation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CapabilityOperation_planDigest_check" CHECK ("planDigest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CapabilityOperation_configurationRevision_check" CHECK ("configurationRevision" >= 1),
    CONSTRAINT "CapabilityOperation_attempts_check" CHECK (
        "attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 25 AND "attempts" <= "maxAttempts"
    ),
    CONSTRAINT "CapabilityOperation_lease_check" CHECK (
        ("lockedAt" IS NULL AND "lockExpiresAt" IS NULL AND "lockedBy" IS NULL)
        OR
        ("lockedAt" IS NOT NULL AND "lockExpiresAt" IS NOT NULL AND "lockedBy" IS NOT NULL AND "lockExpiresAt" > "lockedAt")
    ),
    CONSTRAINT "CapabilityOperation_observation_check" CHECK (
        "status" NOT IN ('APPLYING', 'VERIFYING', 'ACTIVE')
        OR ("observationJson" IS NOT NULL AND "observedAt" IS NOT NULL)
    ),
    CONSTRAINT "CapabilityOperation_completion_check" CHECK (
        "completedAt" IS NULL OR "startedAt" IS NULL OR "completedAt" >= "startedAt"
    )
);

-- CreateTable
CREATE TABLE "CapabilityOperationApproval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "runtimeTargetId" TEXT NOT NULL,
    "approvalMode" "CapabilityApprovalMode" NOT NULL,
    "slot" INTEGER NOT NULL,
    "status" "CapabilityApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "planDigest" TEXT NOT NULL,
    "configurationRevision" INTEGER NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "decidedByUserId" TEXT,
    "reason" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CapabilityOperationApproval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CapabilityOperationApproval_slot_check" CHECK (
        ("approvalMode" = 'SINGLE' AND "slot" = 1)
        OR ("approvalMode" = 'DUAL' AND "slot" BETWEEN 1 AND 2)
    ),
    CONSTRAINT "CapabilityOperationApproval_planDigest_check" CHECK ("planDigest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "CapabilityOperationApproval_configurationRevision_check" CHECK ("configurationRevision" >= 1),
    CONSTRAINT "CapabilityOperationApproval_expiry_check" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "CapabilityOperationApproval_decision_pair_check" CHECK (
        ("decidedByUserId" IS NULL) = ("decidedAt" IS NULL)
    ),
    CONSTRAINT "CapabilityOperationApproval_decision_status_check" CHECK (
        "status" NOT IN ('APPROVED', 'REJECTED')
        OR ("decidedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)
    ),
    CONSTRAINT "CapabilityOperationApproval_distinct_actor_check" CHECK (
        "decidedByUserId" IS NULL OR "requestedByUserId" <> "decidedByUserId"
    )
);

-- CreateTable
CREATE TABLE "CapabilityExecutionReceipt" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "adapterKind" "CapabilityRuntimeTargetKind" NOT NULL,
    "status" "CapabilityReceiptStatus" NOT NULL,
    "outputJsonRedacted" JSONB NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapabilityExecutionReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CapabilityExecutionReceipt_time_order_check" CHECK ("completedAt" >= "startedAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityDefinition_name_version_key" ON "CapabilityDefinition"("name", "version");
CREATE INDEX "CapabilityDefinition_publisher_status_idx" ON "CapabilityDefinition"("publisher", "status");

CREATE UNIQUE INDEX "CapabilityRuntimeTarget_tenantId_workspaceId_name_key" ON "CapabilityRuntimeTarget"("tenantId", "workspaceId", "name");
CREATE INDEX "CapabilityRuntimeTarget_tenantId_workspaceId_status_idx" ON "CapabilityRuntimeTarget"("tenantId", "workspaceId", "status");

CREATE UNIQUE INDEX "CapabilityInstallation_lastOperationId_key" ON "CapabilityInstallation"("lastOperationId");
CREATE UNIQUE INDEX "CapabilityInstallation_tenantId_workspaceId_capabilityName_key" ON "CapabilityInstallation"("tenantId", "workspaceId", "capabilityName");
CREATE INDEX "CapabilityInstallation_tenantId_workspaceId_observedState_idx" ON "CapabilityInstallation"("tenantId", "workspaceId", "observedState");
CREATE INDEX "CapabilityInstallation_orgId_idx" ON "CapabilityInstallation"("orgId");
CREATE INDEX "CapabilityInstallation_definitionId_idx" ON "CapabilityInstallation"("definitionId");
CREATE INDEX "CapabilityInstallation_runtimeTargetId_observedState_idx" ON "CapabilityInstallation"("runtimeTargetId", "observedState");

CREATE UNIQUE INDEX "CapabilityOperation_tenantId_idempotencyKey_key" ON "CapabilityOperation"("tenantId", "idempotencyKey");
CREATE INDEX "CapabilityOperation_tenantId_workspaceId_status_createdAt_idx" ON "CapabilityOperation"("tenantId", "workspaceId", "status", "createdAt");
CREATE INDEX "CapabilityOperation_installationId_status_createdAt_idx" ON "CapabilityOperation"("installationId", "status", "createdAt");
CREATE INDEX "CapabilityOperation_runtimeTargetId_status_idx" ON "CapabilityOperation"("runtimeTargetId", "status");
CREATE INDEX "CapabilityOperation_tenantId_status_nextAttemptAt_lockExpir_idx" ON "CapabilityOperation"("tenantId", "status", "nextAttemptAt", "lockExpiresAt");

CREATE UNIQUE INDEX "CapabilityOperationApproval_operationId_approvalMode_slot_key" ON "CapabilityOperationApproval"("operationId", "approvalMode", "slot");
CREATE UNIQUE INDEX "CapabilityOperationApproval_operationId_decidedByUserId_key" ON "CapabilityOperationApproval"("operationId", "decidedByUserId") WHERE "decidedByUserId" IS NOT NULL;
CREATE INDEX "CapabilityOperationApproval_tenantId_status_expiresAt_idx" ON "CapabilityOperationApproval"("tenantId", "status", "expiresAt");
CREATE INDEX "CapabilityOperationApproval_operationId_idx" ON "CapabilityOperationApproval"("operationId");
CREATE INDEX "CapabilityOperationApproval_runtimeTargetId_idx" ON "CapabilityOperationApproval"("runtimeTargetId");
CREATE INDEX "CapabilityOperationApproval_requestedByUserId_idx" ON "CapabilityOperationApproval"("requestedByUserId");
CREATE INDEX "CapabilityOperationApproval_decidedByUserId_idx" ON "CapabilityOperationApproval"("decidedByUserId");

CREATE UNIQUE INDEX "CapabilityExecutionReceipt_operationId_stepId_key" ON "CapabilityExecutionReceipt"("operationId", "stepId");
CREATE INDEX "CapabilityExecutionReceipt_operationId_status_idx" ON "CapabilityExecutionReceipt"("operationId", "status");

-- AddForeignKey
ALTER TABLE "CapabilityRuntimeTarget" ADD CONSTRAINT "CapabilityRuntimeTarget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CapabilityInstallation" ADD CONSTRAINT "CapabilityInstallation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityInstallation" ADD CONSTRAINT "CapabilityInstallation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityInstallation" ADD CONSTRAINT "CapabilityInstallation_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CapabilityDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityInstallation" ADD CONSTRAINT "CapabilityInstallation_runtimeTargetId_fkey" FOREIGN KEY ("runtimeTargetId") REFERENCES "CapabilityRuntimeTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CapabilityOperation" ADD CONSTRAINT "CapabilityOperation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityOperation" ADD CONSTRAINT "CapabilityOperation_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "CapabilityInstallation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityOperation" ADD CONSTRAINT "CapabilityOperation_runtimeTargetId_fkey" FOREIGN KEY ("runtimeTargetId") REFERENCES "CapabilityRuntimeTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityInstallation" ADD CONSTRAINT "CapabilityInstallation_lastOperationId_fkey" FOREIGN KEY ("lastOperationId") REFERENCES "CapabilityOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CapabilityOperationApproval" ADD CONSTRAINT "CapabilityOperationApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityOperationApproval" ADD CONSTRAINT "CapabilityOperationApproval_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CapabilityOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityOperationApproval" ADD CONSTRAINT "CapabilityOperationApproval_runtimeTargetId_fkey" FOREIGN KEY ("runtimeTargetId") REFERENCES "CapabilityRuntimeTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityOperationApproval" ADD CONSTRAINT "CapabilityOperationApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapabilityOperationApproval" ADD CONSTRAINT "CapabilityOperationApproval_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CapabilityExecutionReceipt" ADD CONSTRAINT "CapabilityExecutionReceipt_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CapabilityOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
