-- CreateTable
CREATE TABLE "BuildOpsProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trade" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "professionalName" TEXT,
    "location" TEXT NOT NULL,
    "budgetEstimate" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "sourceTool" TEXT,
    "sourceToolInput" JSONB,
    "sourceToolResult" JSONB,
    "completion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildOpsProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuildOpsProject_tenantId_status_idx" ON "BuildOpsProject"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BuildOpsProject_tenantId_trade_idx" ON "BuildOpsProject"("tenantId", "trade");

-- CreateIndex
CREATE INDEX "BuildOpsProject_tenantId_createdBy_idx" ON "BuildOpsProject"("tenantId", "createdBy");

-- AddForeignKey
ALTER TABLE "BuildOpsProject" ADD CONSTRAINT "BuildOpsProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildOpsProject" ADD CONSTRAINT "BuildOpsProject_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
