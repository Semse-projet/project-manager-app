-- Prometeo Engine: RAG documents, chunks, assets, work orders

CREATE TABLE "PrometeoDocument" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "projectId"    TEXT,
  "title"        TEXT NOT NULL,
  "sourceType"   TEXT NOT NULL DEFAULT 'text',
  "sourceRef"    TEXT,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "chunkCount"   INTEGER NOT NULL DEFAULT 0,
  "uploadedById" TEXT NOT NULL,
  "errorMsg"     TEXT,
  "metadataJson" JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrometeoDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrometeoDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX "PrometeoDocument_tenantId_projectId_status_idx" ON "PrometeoDocument"("tenantId","projectId","status");
CREATE INDEX "PrometeoDocument_tenantId_sourceType_idx" ON "PrometeoDocument"("tenantId","sourceType");

CREATE TABLE "DocumentChunk" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "documentId"   TEXT NOT NULL,
  "chunkIndex"   INTEGER NOT NULL,
  "text"         TEXT NOT NULL,
  "embeddingJson" JSONB,
  "tokenCount"   INTEGER NOT NULL DEFAULT 0,
  "metadataJson" JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PrometeoDocument"("id") ON DELETE CASCADE
);
CREATE INDEX "DocumentChunk_tenantId_documentId_chunkIndex_idx" ON "DocumentChunk"("tenantId","documentId","chunkIndex");

CREATE TABLE "PrometeoAsset" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "projectId"    TEXT,
  "name"         TEXT NOT NULL,
  "category"     TEXT NOT NULL DEFAULT 'general',
  "status"       TEXT NOT NULL DEFAULT 'available',
  "serialNumber" TEXT,
  "location"     TEXT,
  "metadataJson" JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrometeoAsset_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrometeoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX "PrometeoAsset_tenantId_projectId_status_idx" ON "PrometeoAsset"("tenantId","projectId","status");
CREATE INDEX "PrometeoAsset_tenantId_category_idx" ON "PrometeoAsset"("tenantId","category");

CREATE TABLE "WorkOrder" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "orgId"        TEXT NOT NULL,
  "projectId"    TEXT,
  "jobId"        TEXT,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "priority"     TEXT NOT NULL DEFAULT 'medium',
  "status"       TEXT NOT NULL DEFAULT 'open',
  "assignedToId" TEXT,
  "scheduledAt"  TIMESTAMP(3),
  "dueAt"        TIMESTAMP(3),
  "closedAt"     TIMESTAMP(3),
  "metadataJson" JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX "WorkOrder_tenantId_projectId_status_idx" ON "WorkOrder"("tenantId","projectId","status");
CREATE INDEX "WorkOrder_tenantId_assignedToId_status_idx" ON "WorkOrder"("tenantId","assignedToId","status");
CREATE INDEX "WorkOrder_tenantId_priority_status_idx" ON "WorkOrder"("tenantId","priority","status");
