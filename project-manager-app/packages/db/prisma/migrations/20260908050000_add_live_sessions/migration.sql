-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('REQUESTED', 'PERMISSION_PENDING', 'CONNECTING', 'ACTIVE', 'PAUSED', 'ENDING', 'ENDED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "LiveSessionScopeType" AS ENUM ('job', 'project');

-- CreateEnum
CREATE TYPE "LiveSessionPurpose" AS ENUM ('inspection', 'assist');

-- CreateEnum
CREATE TYPE "LiveSessionParticipantRole" AS ENUM ('owner', 'inspector', 'assistant', 'observer');

-- CreateTable
CREATE TABLE "live_session" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeType" "LiveSessionScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "purpose" "LiveSessionPurpose" NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_session_participant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LiveSessionParticipantRole" NOT NULL,
    "invitedById" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_session_participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "live_session_tenantId_status_createdAt_idx" ON "live_session"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "live_session_tenantId_scopeType_scopeId_status_idx" ON "live_session"("tenantId", "scopeType", "scopeId", "status");

-- CreateIndex
CREATE INDEX "live_session_tenantId_createdById_createdAt_idx" ON "live_session"("tenantId", "createdById", "createdAt");

-- CreateIndex
CREATE INDEX "live_session_status_expiresAt_idx" ON "live_session"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "live_session_tenantId_idempotencyKey_key" ON "live_session"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "live_session_participant_tenantId_userId_idx" ON "live_session_participant"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "live_session_participant_sessionId_idx" ON "live_session_participant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "live_session_participant_sessionId_userId_key" ON "live_session_participant"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "live_session" ADD CONSTRAINT "live_session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_session" ADD CONSTRAINT "live_session_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_session_participant" ADD CONSTRAINT "live_session_participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_session_participant" ADD CONSTRAINT "live_session_participant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_session_participant" ADD CONSTRAINT "live_session_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
