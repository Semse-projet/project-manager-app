-- CreateTable
CREATE TABLE "OperationalSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recommendedAction" TEXT,
    "sourceAgent" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "jobId" TEXT,
    "buildOpsProjectId" TEXT,
    "milestoneId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OperationalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "contextSnapshotJson" JSONB,
    "decisionJson" JSONB,
    "signalsCreated" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperationalSignal_tenantId_status_idx" ON "OperationalSignal"("tenantId", "status");
CREATE INDEX "OperationalSignal_type_idx" ON "OperationalSignal"("type");
CREATE INDEX "OperationalSignal_severity_idx" ON "OperationalSignal"("severity");
CREATE INDEX "OperationalSignal_status_idx" ON "OperationalSignal"("status");
CREATE INDEX "OperationalSignal_entityType_entityId_idx" ON "OperationalSignal"("entityType", "entityId");
CREATE INDEX "OperationalSignal_jobId_idx" ON "OperationalSignal"("jobId");
CREATE INDEX "OperationalSignal_buildOpsProjectId_idx" ON "OperationalSignal"("buildOpsProjectId");
CREATE INDEX "OperationalSignal_milestoneId_idx" ON "OperationalSignal"("milestoneId");
CREATE INDEX "OperationalSignal_createdAt_idx" ON "OperationalSignal"("createdAt");

-- CreateIndex
CREATE INDEX "IntelligenceRun_agentName_idx" ON "IntelligenceRun"("agentName");
CREATE INDEX "IntelligenceRun_tenantId_idx" ON "IntelligenceRun"("tenantId");
CREATE INDEX "IntelligenceRun_entityType_entityId_idx" ON "IntelligenceRun"("entityType", "entityId");
CREATE INDEX "IntelligenceRun_createdAt_idx" ON "IntelligenceRun"("createdAt");
