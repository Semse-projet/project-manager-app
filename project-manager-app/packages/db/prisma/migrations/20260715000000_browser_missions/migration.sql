-- CreateTable
CREATE TABLE "BrowserMission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "budgetLimit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrowserMissionStep" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "engineUsed" TEXT NOT NULL DEFAULT 'PLAYWRIGHT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "evidenceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrowserMissionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowserMission_tenantId_createdAt_idx" ON "BrowserMission"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "BrowserMission_actorId_idx" ON "BrowserMission"("actorId");

-- CreateIndex
CREATE INDEX "BrowserMissionStep_missionId_stepNumber_idx" ON "BrowserMissionStep"("missionId", "stepNumber");

-- AddForeignKey
ALTER TABLE "BrowserMissionStep" ADD CONSTRAINT "BrowserMissionStep_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "BrowserMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

