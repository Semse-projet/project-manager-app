-- PR-5 (docs/specs/core/knowledge-contributor-transcript-observation.spec.md)
-- Purely additive: one new enum value, two new tables, no existing table touched.

-- AlterEnum
ALTER TYPE "KnowledgeExtractionStatus" ADD VALUE 'PROCESSING';

-- CreateTable
CREATE TABLE "TranscriptSegment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "objective" TEXT,
    "condition" TEXT,
    "decision" TEXT,
    "reason" TEXT,
    "method" TEXT,
    "action" TEXT,
    "result" TEXT,
    "sourceSegmentIdsJson" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "correctedFieldsJson" JSONB,
    "correctedByUserId" TEXT,
    "correctedReason" TEXT,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptSegment_tenantId_submissionId_idx" ON "TranscriptSegment"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "TranscriptSegment_extractionId_idx" ON "TranscriptSegment"("extractionId");

-- CreateIndex
CREATE INDEX "TranscriptSegment_assetId_startMs_idx" ON "TranscriptSegment"("assetId", "startMs");

-- CreateIndex
CREATE INDEX "Observation_tenantId_submissionId_idx" ON "Observation"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "Observation_extractionId_idx" ON "Observation"("extractionId");

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "KnowledgeAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "KnowledgeExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KnowledgeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "KnowledgeExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
