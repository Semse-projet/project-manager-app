-- CreateEnum
CREATE TYPE "KnowledgeMissionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeMissionAcceptanceStatus" AS ENUM ('ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "KnowledgeSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'PAYMENT_PENDING', 'PAID', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeAssetKind" AS ENUM ('VIDEO', 'IMAGE', 'AUDIO', 'TEXT');

-- CreateEnum
CREATE TYPE "KnowledgeAssetClipRole" AS ENUM ('BEFORE', 'PLANNING', 'EXECUTION', 'PROBLEM_CORRECTION', 'RESULT', 'OTHER');

-- CreateEnum
CREATE TYPE "KnowledgeAssetProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "KnowledgeAppealStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED');

-- CreateEnum
CREATE TYPE "KnowledgeExtractionKind" AS ENUM ('TRANSCRIPTION', 'SEGMENTATION', 'ENTITY', 'TASK_STEP', 'MEASUREMENT', 'TOOL_MATERIAL', 'PROBLEM_SOLUTION', 'QUALITY_FLAG');

-- CreateEnum
CREATE TYPE "KnowledgeExtractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ContributorRewardStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'PAYMENT_PENDING', 'PAID', 'BLOCKED_NO_PAYOUT_ACCOUNT', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "ContributorProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trade" TEXT NOT NULL DEFAULT 'electrician',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributorTermsVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "contentEs" TEXT NOT NULL,
    "contentEn" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributorTermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributorConsent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersionId" TEXT NOT NULL,
    "termsContentHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CONTRIBUTOR_PROGRAM',
    "checkboxesJson" JSONB NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributorConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeMission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "requirementsJson" JSONB NOT NULL,
    "evidenceRequestedJson" JSONB NOT NULL,
    "acceptanceCriteriaJson" JSONB NOT NULL,
    "baseCompensationCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bonusJson" JSONB,
    "deadlineAt" TIMESTAMP(3),
    "maxParticipants" INTEGER,
    "status" "KnowledgeMissionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeMissionAcceptance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "missionVersionSnapshot" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "compensationCentsSnapshot" INTEGER NOT NULL,
    "currencySnapshot" TEXT NOT NULL,
    "deadlineAtSnapshot" TIMESTAMP(3),
    "status" "KnowledgeMissionAcceptanceStatus" NOT NULL DEFAULT 'ACCEPTED',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeMissionAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KnowledgeSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "kind" "KnowledgeAssetKind" NOT NULL,
    "clipRole" "KnowledgeAssetClipRole" NOT NULL DEFAULT 'OTHER',
    "storageKey" TEXT,
    "textContent" TEXT,
    "checksum" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "processingStatus" "KnowledgeAssetProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "decision" "KnowledgeReviewDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "qualityFlagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeAppeal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalReviewId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "KnowledgeAppealStatus" NOT NULL DEFAULT 'OPEN',
    "resolverUserId" TEXT,
    "resolutionReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeExtraction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assetId" TEXT,
    "kind" "KnowledgeExtractionKind" NOT NULL,
    "status" "KnowledgeExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "modelOrProcess" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "timeRangeJson" JSONB,
    "dataJson" JSONB,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributorReward" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "ContributorRewardStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "idempotencyKey" TEXT NOT NULL,
    "authorizedByUserId" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributorReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContributorProfile_userId_key" ON "ContributorProfile"("userId");

-- CreateIndex
CREATE INDEX "ContributorProfile_tenantId_status_idx" ON "ContributorProfile"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorTermsVersion_version_key" ON "ContributorTermsVersion"("version");

-- CreateIndex
CREATE INDEX "ContributorTermsVersion_isActive_idx" ON "ContributorTermsVersion"("isActive");

-- CreateIndex
CREATE INDEX "ContributorConsent_tenantId_userId_idx" ON "ContributorConsent"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorConsent_userId_termsVersionId_key" ON "ContributorConsent"("userId", "termsVersionId");

-- CreateIndex
CREATE INDEX "KnowledgeMission_tenantId_status_idx" ON "KnowledgeMission"("tenantId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeMission_tenantId_trade_status_idx" ON "KnowledgeMission"("tenantId", "trade", "status");

-- CreateIndex
CREATE INDEX "KnowledgeMissionAcceptance_tenantId_userId_status_idx" ON "KnowledgeMissionAcceptance"("tenantId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeMissionAcceptance_missionId_userId_key" ON "KnowledgeMissionAcceptance"("missionId", "userId");

-- CreateIndex
CREATE INDEX "KnowledgeSubmission_tenantId_userId_status_idx" ON "KnowledgeSubmission"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeSubmission_tenantId_missionId_status_idx" ON "KnowledgeSubmission"("tenantId", "missionId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeAsset_tenantId_submissionId_idx" ON "KnowledgeAsset"("tenantId", "submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeAsset_submissionId_storageKey_key" ON "KnowledgeAsset"("submissionId", "storageKey");

-- CreateIndex
CREATE INDEX "KnowledgeReview_tenantId_submissionId_idx" ON "KnowledgeReview"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "KnowledgeAppeal_tenantId_submissionId_idx" ON "KnowledgeAppeal"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "KnowledgeAppeal_tenantId_status_idx" ON "KnowledgeAppeal"("tenantId", "status");

-- CreateIndex
CREATE INDEX "KnowledgeExtraction_tenantId_submissionId_idx" ON "KnowledgeExtraction"("tenantId", "submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorReward_submissionId_key" ON "ContributorReward"("submissionId");

-- CreateIndex
CREATE INDEX "ContributorReward_tenantId_status_idx" ON "ContributorReward"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorReward_tenantId_idempotencyKey_key" ON "ContributorReward"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ContributorProfile" ADD CONSTRAINT "ContributorProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorProfile" ADD CONSTRAINT "ContributorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorConsent" ADD CONSTRAINT "ContributorConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorConsent" ADD CONSTRAINT "ContributorConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorConsent" ADD CONSTRAINT "ContributorConsent_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "ContributorTermsVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMission" ADD CONSTRAINT "KnowledgeMission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMission" ADD CONSTRAINT "KnowledgeMission_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMissionAcceptance" ADD CONSTRAINT "KnowledgeMissionAcceptance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMissionAcceptance" ADD CONSTRAINT "KnowledgeMissionAcceptance_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "KnowledgeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMissionAcceptance" ADD CONSTRAINT "KnowledgeMissionAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSubmission" ADD CONSTRAINT "KnowledgeSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSubmission" ADD CONSTRAINT "KnowledgeSubmission_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "KnowledgeMissionAcceptance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSubmission" ADD CONSTRAINT "KnowledgeSubmission_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "KnowledgeMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSubmission" ADD CONSTRAINT "KnowledgeSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAsset" ADD CONSTRAINT "KnowledgeAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAsset" ADD CONSTRAINT "KnowledgeAsset_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAsset" ADD CONSTRAINT "KnowledgeAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeReview" ADD CONSTRAINT "KnowledgeReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeReview" ADD CONSTRAINT "KnowledgeReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeReview" ADD CONSTRAINT "KnowledgeReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAppeal" ADD CONSTRAINT "KnowledgeAppeal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAppeal" ADD CONSTRAINT "KnowledgeAppeal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAppeal" ADD CONSTRAINT "KnowledgeAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAppeal" ADD CONSTRAINT "KnowledgeAppeal_originalReviewId_fkey" FOREIGN KEY ("originalReviewId") REFERENCES "KnowledgeReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAppeal" ADD CONSTRAINT "KnowledgeAppeal_resolverUserId_fkey" FOREIGN KEY ("resolverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeExtraction" ADD CONSTRAINT "KnowledgeExtraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeExtraction" ADD CONSTRAINT "KnowledgeExtraction_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeExtraction" ADD CONSTRAINT "KnowledgeExtraction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "KnowledgeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorReward" ADD CONSTRAINT "ContributorReward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorReward" ADD CONSTRAINT "ContributorReward_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorReward" ADD CONSTRAINT "ContributorReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
