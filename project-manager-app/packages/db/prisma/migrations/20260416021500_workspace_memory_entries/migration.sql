-- Dedicated persistence for workspace memory records used by operacion asistida.
CREATE TABLE "WorkspaceMemoryEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "repoId" TEXT,
  "runId" TEXT,
  "taskId" TEXT,
  "kind" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMemoryEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceMemoryEntry_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WorkspaceMemoryEntry_tenantId_workspaceId_updatedAt_idx"
  ON "WorkspaceMemoryEntry"("tenantId", "workspaceId", "updatedAt");

CREATE INDEX "WorkspaceMemoryEntry_tenantId_workspaceId_kind_updatedAt_idx"
  ON "WorkspaceMemoryEntry"("tenantId", "workspaceId", "kind", "updatedAt");

CREATE INDEX "WorkspaceMemoryEntry_tenantId_workspaceId_runId_idx"
  ON "WorkspaceMemoryEntry"("tenantId", "workspaceId", "runId");

CREATE INDEX "WorkspaceMemoryEntry_tenantId_workspaceId_taskId_idx"
  ON "WorkspaceMemoryEntry"("tenantId", "workspaceId", "taskId");
