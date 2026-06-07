-- Prometeo Phase 5: Human Feedback Memory Loop
-- Stores per-chunk human feedback to boost/penalize retrieval scoring.

CREATE TABLE "PrometeoChunkFeedback" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "chunkId"    TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "note"       TEXT,
    "query"      TEXT,
    "tradeTag"   TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrometeoChunkFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrometeoChunkFeedback_tenantId_chunkId_idx"    ON "PrometeoChunkFeedback"("tenantId", "chunkId");
CREATE INDEX "PrometeoChunkFeedback_tenantId_documentId_idx" ON "PrometeoChunkFeedback"("tenantId", "documentId");
CREATE INDEX "PrometeoChunkFeedback_tenantId_userId_idx"     ON "PrometeoChunkFeedback"("tenantId", "userId");

ALTER TABLE "PrometeoChunkFeedback"
    ADD CONSTRAINT "PrometeoChunkFeedback_chunkId_fkey"
    FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
