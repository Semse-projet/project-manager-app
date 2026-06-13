-- CreateTable
CREATE TABLE "VisionAnalysis" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "jobId" TEXT,
    "milestoneId" TEXT,
    "trade" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "qualityScore" DOUBLE PRECISION,
    "blurScore" DOUBLE PRECISION,
    "brightnessScore" DOUBLE PRECISION,
    "contrastScore" DOUBLE PRECISION,
    "duplicateRisk" DOUBLE PRECISION,
    "changeScore" DOUBLE PRECISION,
    "visualProgressDetected" BOOLEAN NOT NULL DEFAULT false,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT true,
    "canAutoApprove" BOOLEAN NOT NULL DEFAULT false,
    "recommendedAction" TEXT,
    "riskLevel" TEXT,
    "riskReasons" JSONB,
    "rawResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisionAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisionAnalysis_evidenceId_key" ON "VisionAnalysis"("evidenceId");

-- CreateIndex
CREATE INDEX "VisionAnalysis_evidenceId_idx" ON "VisionAnalysis"("evidenceId");

-- CreateIndex
CREATE INDEX "VisionAnalysis_jobId_idx" ON "VisionAnalysis"("jobId");

-- CreateIndex
CREATE INDEX "VisionAnalysis_milestoneId_idx" ON "VisionAnalysis"("milestoneId");

-- CreateIndex
CREATE INDEX "VisionAnalysis_status_idx" ON "VisionAnalysis"("status");
