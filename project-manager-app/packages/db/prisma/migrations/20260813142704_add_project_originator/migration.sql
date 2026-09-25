-- CreateEnum
CREATE TYPE "ProjectOriginatorStatus" AS ENUM ('PENDING_OWNER_VALIDATION', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OriginatorRewardType" AS ENUM ('FIXED_BONUS', 'PLATFORM_FEE_SHARE');

-- CreateEnum
CREATE TYPE "OriginatorRewardStatus" AS ENUM ('PENDING_REVIEW', 'BLOCKED_NO_PAYOUT_ACCOUNT', 'RELEASED', 'RELEASE_FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "ProjectOriginator" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originatorUserId" TEXT NOT NULL,
    "status" "ProjectOriginatorStatus" NOT NULL DEFAULT 'PENDING_OWNER_VALIDATION',
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOriginator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OriginatorReward" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectOriginatorId" TEXT NOT NULL,
    "type" "OriginatorRewardType" NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "platformFeeCentsSnapshot" INTEGER,
    "status" "OriginatorRewardStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewEndsAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "releaseFailedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OriginatorReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectOriginator_tenantId_originatorUserId_idx" ON "ProjectOriginator"("tenantId", "originatorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOriginator_projectId_key" ON "ProjectOriginator"("projectId");

-- CreateIndex
CREATE INDEX "OriginatorReward_tenantId_status_idx" ON "OriginatorReward"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OriginatorReward_projectOriginatorId_idx" ON "OriginatorReward"("projectOriginatorId");
