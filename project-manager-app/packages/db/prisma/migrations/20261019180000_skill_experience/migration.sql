-- BO-12 skills: tablas aditivas, sin backfill ni DML. No toca TaskAllocation ni JobTask.
CREATE TABLE "SkillExperience" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'TASK_ALLOCATION',
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceLevel" TEXT NOT NULL DEFAULT 'supervisor_reviewed',
    "reviewedByUserId" TEXT NOT NULL,
    "reviewNote" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SkillAttestation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillAttestation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SkillExperience_sourceType_sourceId_key" ON "SkillExperience"("sourceType", "sourceId");
CREATE INDEX "SkillExperience_userId_status_trade_idx" ON "SkillExperience"("userId", "status", "trade");
CREATE INDEX "SkillExperience_tenantId_orgId_idx" ON "SkillExperience"("tenantId", "orgId");
CREATE UNIQUE INDEX "SkillAttestation_tokenHash_key" ON "SkillAttestation"("tokenHash");
CREATE INDEX "SkillAttestation_userId_status_idx" ON "SkillAttestation"("userId", "status");
