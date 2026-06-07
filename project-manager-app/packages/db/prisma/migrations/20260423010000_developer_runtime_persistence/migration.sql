CREATE TABLE IF NOT EXISTS "DeveloperRuntimeSessionStore" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "repoId" TEXT NOT NULL,
  "branch" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "goal" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "selectedAgentsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "missionId" TEXT NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperRuntimeSessionStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperRuntimeSessionStore_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeveloperRuntimeSessionStore_tenant_state_idx"
  ON "DeveloperRuntimeSessionStore"("tenantId", "state", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "DeveloperRuntimeSessionStore_tenant_repo_idx"
  ON "DeveloperRuntimeSessionStore"("tenantId", "repoId", "startedAt" DESC);

CREATE TABLE IF NOT EXISTS "DeveloperRuntimeMissionStore" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "intentJson" JSONB NOT NULL,
  "planJson" JSONB NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperRuntimeMissionStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperRuntimeMissionStore_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeveloperRuntimeMissionStore_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DeveloperRuntimeSessionStore"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeveloperRuntimeMissionStore_tenant_session_idx"
  ON "DeveloperRuntimeMissionStore"("tenantId", "sessionId");

CREATE TABLE IF NOT EXISTS "DeveloperRuntimeLogStore" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperRuntimeLogStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperRuntimeLogStore_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeveloperRuntimeLogStore_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DeveloperRuntimeSessionStore"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeveloperRuntimeLogStore_tenant_session_idx"
  ON "DeveloperRuntimeLogStore"("tenantId", "sessionId", "occurredAt" ASC);

CREATE TABLE IF NOT EXISTS "DeveloperRuntimeValidationStore" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperRuntimeValidationStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperRuntimeValidationStore_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeveloperRuntimeValidationStore_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DeveloperRuntimeSessionStore"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeveloperRuntimeValidationStore_tenant_session_idx"
  ON "DeveloperRuntimeValidationStore"("tenantId", "sessionId", "createdAt" ASC);

CREATE TABLE IF NOT EXISTS "DeveloperRuntimeArtifactStore" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperRuntimeArtifactStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperRuntimeArtifactStore_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeveloperRuntimeArtifactStore_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DeveloperRuntimeSessionStore"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeveloperRuntimeArtifactStore_tenant_session_idx"
  ON "DeveloperRuntimeArtifactStore"("tenantId", "sessionId", "createdAt" ASC);

CREATE TABLE IF NOT EXISTS "DeveloperRuntimeApprovalStore" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "requestJson" JSONB NOT NULL,
  "decisionJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperRuntimeApprovalStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeveloperRuntimeApprovalStore_requestId_key" UNIQUE ("requestId"),
  CONSTRAINT "DeveloperRuntimeApprovalStore_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeveloperRuntimeApprovalStore_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "DeveloperRuntimeSessionStore"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "DeveloperRuntimeApprovalStore_tenant_session_idx"
  ON "DeveloperRuntimeApprovalStore"("tenantId", "sessionId", "createdAt" ASC);
