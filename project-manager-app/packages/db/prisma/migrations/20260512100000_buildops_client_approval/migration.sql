ALTER TABLE "BuildOpsProject"
  ADD COLUMN "clientPlanApprovalStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "clientPlanApprovedAt" TIMESTAMP(3),
  ADD COLUMN "clientPlanApprovedById" TEXT,
  ADD COLUMN "clientPlanApprovalSource" TEXT,
  ADD COLUMN "clientPlanApprovalReason" TEXT,
  ADD COLUMN "clientPlanReviewedAt" TIMESTAMP(3),
  ADD COLUMN "clientPlanReviewComment" TEXT,
  ADD COLUMN "clientPlanUnapprovedAt" TIMESTAMP(3),
  ADD COLUMN "clientPlanUnapprovedById" TEXT,
  ADD COLUMN "clientPlanUnapprovalReason" TEXT,
  ADD COLUMN "legacyPromotionStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "legacyPromotedAt" TIMESTAMP(3);

CREATE INDEX "BuildOpsProject_tenantId_clientPlanApprovalStatus_idx"
  ON "BuildOpsProject"("tenantId", "clientPlanApprovalStatus");

CREATE INDEX "BuildOpsProject_tenantId_legacyPromotionStatus_idx"
  ON "BuildOpsProject"("tenantId", "legacyPromotionStatus");
