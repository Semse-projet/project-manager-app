-- CreateTable
CREATE TABLE "ProjectIntake" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "sessionToken" TEXT,
  "publishedJobId" TEXT,
  "rawDescription" TEXT NOT NULL,
  "providedTitle" TEXT,
  "normalizedTitle" TEXT NOT NULL,
  "selectedCategoryId" TEXT,
  "selectedSubcategoryId" TEXT,
  "detectedCategory" TEXT NOT NULL,
  "detectedSubcategory" TEXT,
  "modality" TEXT,
  "city" TEXT,
  "urgency" TEXT,
  "detectedLanguage" TEXT NOT NULL DEFAULT 'es',
  "categoryConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accuracyScore" INTEGER NOT NULL DEFAULT 0,
  "accuracyLevel" TEXT NOT NULL DEFAULT 'low',
  "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "recommendedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "answersJson" JSONB,
  "uploadedImagesJson" JSONB,
  "estimatePreferenceJson" JSONB,
  "projectScopeJson" JSONB,
  "generatedEstimateJson" JSONB,
  "generatedMilestonesJson" JSONB,
  "activeWarningsJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "claimedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectIntake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectIntake_tenantId_sessionToken_idx" ON "ProjectIntake"("tenantId", "sessionToken");

-- CreateIndex
CREATE INDEX "ProjectIntake_tenantId_userId_idx" ON "ProjectIntake"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ProjectIntake_tenantId_status_idx" ON "ProjectIntake"("tenantId", "status");
