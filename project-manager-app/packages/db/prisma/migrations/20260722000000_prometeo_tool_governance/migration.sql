-- CreateEnum
CREATE TYPE "PrometeoProposedActionStatus" AS ENUM ('PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'BLOCKED', 'EXECUTED');

-- CreateTable
CREATE TABLE "prometeo_proposed_action" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvalPolicy" TEXT NOT NULL,
    "status" "PrometeoProposedActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "inputJson" JSONB NOT NULL,
    "requiredApprovals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prometeo_proposed_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prometeo_tool_invocation_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockedReason" TEXT,
    "requestId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prometeo_tool_invocation_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prometeo_proposed_action_tenantId_status_createdAt_idx" ON "prometeo_proposed_action"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "prometeo_tool_invocation_audit_tenantId_occurredAt_idx" ON "prometeo_tool_invocation_audit"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "prometeo_tool_invocation_audit_tenantId_status_occurredAt_idx" ON "prometeo_tool_invocation_audit"("tenantId", "status", "occurredAt");
