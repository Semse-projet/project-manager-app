-- AI Models: interaction logging + operational context

CREATE TABLE "AiInteractionLog" (
  "id"                  TEXT        NOT NULL,
  "tenantId"            TEXT,
  "agentId"             TEXT,
  "projectId"           TEXT,
  "userId"              TEXT,
  "taskType"            TEXT        NOT NULL,
  "provider"            TEXT        NOT NULL,
  "modelSlug"           TEXT        NOT NULL,
  "modelName"           TEXT,
  "inputLength"         INTEGER     NOT NULL DEFAULT 0,
  "outputLength"        INTEGER     NOT NULL DEFAULT 0,
  "inputTokens"         INTEGER,
  "outputTokens"        INTEGER,
  "estimatedCostUsd"    DECIMAL(10,6),
  "latencyMs"           INTEGER,
  "routeReason"         TEXT,
  "fallbackUsed"        BOOLEAN     NOT NULL DEFAULT false,
  "success"             BOOLEAN     NOT NULL DEFAULT true,
  "errorMessage"        TEXT,
  "eligibleForTraining" BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiInteractionLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiInteractionLog_tenantId_taskType_createdAt_idx" ON "AiInteractionLog"("tenantId","taskType","createdAt");
CREATE INDEX "AiInteractionLog_provider_modelSlug_createdAt_idx" ON "AiInteractionLog"("provider","modelSlug","createdAt");
CREATE INDEX "AiInteractionLog_agentId_projectId_createdAt_idx" ON "AiInteractionLog"("agentId","projectId","createdAt");

CREATE TABLE "OperationalContextSnapshot" (
  "id"           TEXT         NOT NULL,
  "tenantId"     TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "projectId"    TEXT,
  "role"         TEXT         NOT NULL DEFAULT 'client',
  "snapshotJson" JSONB        NOT NULL,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalContextSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalContextSnapshot_tenantId_userId_expiresAt_idx" ON "OperationalContextSnapshot"("tenantId","userId","expiresAt");
