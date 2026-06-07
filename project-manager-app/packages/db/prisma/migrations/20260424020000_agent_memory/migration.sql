-- CreateTable: AgentMemory — durable, per-project agent memory store
CREATE TABLE "AgentMemory" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "orgId"           TEXT NOT NULL,
    "agentId"         TEXT NOT NULL,
    "sessionId"       TEXT,
    "projectId"       TEXT,
    "workspaceId"     TEXT,
    "type"            TEXT NOT NULL,
    "content"         TEXT NOT NULL,
    "summary"         TEXT NOT NULL,
    "importanceScore" INTEGER NOT NULL DEFAULT 3,
    "tags"            TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceRef"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- FK → Tenant
ALTER TABLE "AgentMemory"
    ADD CONSTRAINT "AgentMemory_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "AgentMemory_tenantId_projectId_type_updatedAt_idx"
    ON "AgentMemory"("tenantId", "projectId", "type", "updatedAt");

CREATE INDEX "AgentMemory_tenantId_agentId_sessionId_idx"
    ON "AgentMemory"("tenantId", "agentId", "sessionId");

CREATE INDEX "AgentMemory_tenantId_projectId_importanceScore_idx"
    ON "AgentMemory"("tenantId", "projectId", "importanceScore");
