-- AlterTable
ALTER TABLE "AgentMemory" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "conflictsWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "correctedFromId" TEXT,
ADD COLUMN     "epistemicStatus" TEXT NOT NULL DEFAULT 'remembered_context',
ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "invalidatedBy" TEXT,
ADD COLUMN     "invalidationReason" TEXT,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "retentionUntil" TIMESTAMP(3),
ADD COLUMN     "sensitivity" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectType" TEXT,
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "supersedesId" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceMemoryEntry" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "conflictsWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "correctedFromId" TEXT,
ADD COLUMN     "epistemicStatus" TEXT NOT NULL DEFAULT 'remembered_context',
ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "invalidatedBy" TEXT,
ADD COLUMN     "invalidationReason" TEXT,
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "retentionUntil" TIMESTAMP(3),
ADD COLUMN     "sensitivity" TEXT NOT NULL DEFAULT 'internal',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectType" TEXT,
ADD COLUMN     "supersededById" TEXT,
ADD COLUMN     "supersedesId" TEXT;

-- CreateIndex
CREATE INDEX "AgentMemory_tenantId_projectId_status_idx" ON "AgentMemory"("tenantId", "projectId", "status");

-- CreateIndex
CREATE INDEX "AgentMemory_tenantId_subjectType_subjectId_idx" ON "AgentMemory"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AgentMemory_tenantId_retentionUntil_idx" ON "AgentMemory"("tenantId", "retentionUntil");

-- CreateIndex
CREATE INDEX "WorkspaceMemoryEntry_tenantId_workspaceId_status_idx" ON "WorkspaceMemoryEntry"("tenantId", "workspaceId", "status");

-- CreateIndex
CREATE INDEX "WorkspaceMemoryEntry_tenantId_subjectType_subjectId_idx" ON "WorkspaceMemoryEntry"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "WorkspaceMemoryEntry_tenantId_retentionUntil_idx" ON "WorkspaceMemoryEntry"("tenantId", "retentionUntil");
