-- CreateTable
CREATE TABLE "prometeo_workspace_state" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentScreen" TEXT NOT NULL,
    "activeSection" TEXT NOT NULL,
    "navigationHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rightPanelMode" TEXT NOT NULL,
    "activeMissionId" TEXT,
    "activeMissionType" TEXT,
    "activeMissionTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prometeo_workspace_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prometeo_copilot_session" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "lastMissionSuggestion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prometeo_copilot_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prometeo_orchestration" (
    "id" UUID NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "interpretation" JSONB NOT NULL,
    "agentsConsulted" JSONB NOT NULL,
    "plan" JSONB NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL,
    "errors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prometeo_orchestration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prometeo_workspace_state_tenantId_userId_key" ON "prometeo_workspace_state"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "prometeo_copilot_session_tenantId_idx" ON "prometeo_copilot_session"("tenantId");

-- CreateIndex
CREATE INDEX "prometeo_orchestration_tenantId_idx" ON "prometeo_orchestration"("tenantId");

