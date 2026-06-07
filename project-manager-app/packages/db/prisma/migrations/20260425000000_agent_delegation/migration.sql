-- CreateTable: AgentDelegation — sub-task delegated from coordinator to specialized agent
CREATE TABLE "AgentDelegation" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "orgId"           TEXT NOT NULL,
    "projectId"       TEXT,
    "sourceRunId"     TEXT,
    "targetRunId"     TEXT,
    "coordinatorId"   TEXT NOT NULL,
    "targetAgentId"   TEXT NOT NULL,
    "taskTitle"       TEXT NOT NULL,
    "taskContextJson" JSONB NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "resultJson"      JSONB,
    "error"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDelegation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AgentDelegation"
    ADD CONSTRAINT "AgentDelegation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AgentDelegation_tenantId_projectId_status_idx" ON "AgentDelegation"("tenantId", "projectId", "status");
CREATE INDEX "AgentDelegation_tenantId_sourceRunId_idx"       ON "AgentDelegation"("tenantId", "sourceRunId");
CREATE INDEX "AgentDelegation_tenantId_targetRunId_idx"       ON "AgentDelegation"("tenantId", "targetRunId");
