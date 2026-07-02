-- Migration: harness_work_item
-- F4 AgentHarness v1: canonical WorkItem table.
-- Persists human-opened units of work dispatched to agents.
-- L2+ items require a DecisionPackage and human approval before any mutation.

CREATE TABLE "HarnessWorkItem" (
    "id"                  TEXT NOT NULL,
    "tenantId"            TEXT NOT NULL,
    "humanOwner"          TEXT NOT NULL,
    "objective"           TEXT NOT NULL,
    "riskLevel"           TEXT NOT NULL DEFAULT 'L0',
    "status"              TEXT NOT NULL DEFAULT 'open',
    "suggestedAgents"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "allowedTools"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "forbiddenTools"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "acceptanceCriteria"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rollbackRequired"    BOOLEAN NOT NULL DEFAULT false,
    "contextRefsJson"     JSONB,
    "servicesJson"        JSONB,
    "decisionPackageJson" JSONB,
    "approvedAt"          TIMESTAMP(3),
    "approvedBy"          TEXT,
    "rejectedAt"          TIMESTAMP(3),
    "rejectedBy"          TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HarnessWorkItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HarnessWorkItem_tenantId_status_idx"          ON "HarnessWorkItem"("tenantId", "status");
CREATE INDEX "HarnessWorkItem_tenantId_humanOwner_idx"       ON "HarnessWorkItem"("tenantId", "humanOwner");
CREATE INDEX "HarnessWorkItem_tenantId_riskLevel_status_idx" ON "HarnessWorkItem"("tenantId", "riskLevel", "status");

ALTER TABLE "HarnessWorkItem"
    ADD CONSTRAINT "HarnessWorkItem_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
