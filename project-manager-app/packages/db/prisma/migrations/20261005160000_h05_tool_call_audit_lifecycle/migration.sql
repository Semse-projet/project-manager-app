-- H05 (spec docs/specs/prometeo/tool-call-audit-lineage.spec.md): auditoría canónica por tool call y estado de
-- ejecución de las aprobaciones del copiloto.
-- Migración ADITIVA: solo columnas NULABLES e índices sobre tablas existentes. Sin backfill, sin tocar filas, sin
-- tablas nuevas. El código anterior ignora estas columnas.
--
-- ROLLBACK OPERATIVO: PROMETEO_TOOL_AUDIT_LIFECYCLE=off (deja de escribirlas; no destruye historial). Retirar el esquema
-- NO es un rollback: solo con una migración posterior, con respaldo/exportación de las trazas y decisión explícita del
-- dueño. SQL de retirada, solo con esa autorización:
--   DROP INDEX "prometeo_tool_invocation_audit_executionId_key";
--   DROP INDEX "prometeo_tool_invocation_audit_tenantId_projectId_startedAt_idx";
--   DROP INDEX "prometeo_tool_invocation_audit_tenantId_runId_idx";
--   DROP INDEX "prometeo_tool_invocation_audit_status_startedAt_idx";
--   DROP INDEX "prometeo_tool_invocation_audit_expiresAt_idx";
--   ALTER TABLE "prometeo_tool_invocation_audit" DROP COLUMN "executionId", DROP COLUMN "source", DROP COLUMN "runId",
--     DROP COLUMN "sessionId", DROP COLUMN "threadId", DROP COLUMN "projectId", DROP COLUMN "agentId",
--     DROP COLUMN "approvalId", DROP COLUMN "proposedActionId", DROP COLUMN "policyVersion", DROP COLUMN "startedAt",
--     DROP COLUMN "completedAt", DROP COLUMN "durationMs", DROP COLUMN "inputDigest", DROP COLUMN "outputDigest",
--     DROP COLUMN "inputSummary", DROP COLUMN "outputSummary", DROP COLUMN "errorCode", DROP COLUMN "redactionVersion",
--     DROP COLUMN "expiresAt";
--   DROP INDEX "AgentApproval_tenantId_status_executionStatus_idx";
--   ALTER TABLE "AgentApproval" DROP COLUMN "executionStatus", DROP COLUMN "executionStartedAt",
--     DROP COLUMN "executionFinishedAt", DROP COLUMN "executionError", DROP COLUMN "executionId";
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261005160000_h05_tool_call_audit_lifecycle';

-- AlterTable
ALTER TABLE "prometeo_tool_invocation_audit"
    ADD COLUMN "executionId" TEXT,
    ADD COLUMN "source" TEXT,
    ADD COLUMN "runId" TEXT,
    ADD COLUMN "sessionId" TEXT,
    ADD COLUMN "threadId" TEXT,
    ADD COLUMN "projectId" TEXT,
    ADD COLUMN "agentId" TEXT,
    ADD COLUMN "approvalId" TEXT,
    ADD COLUMN "proposedActionId" TEXT,
    ADD COLUMN "policyVersion" TEXT,
    ADD COLUMN "startedAt" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "durationMs" INTEGER,
    ADD COLUMN "inputDigest" TEXT,
    ADD COLUMN "outputDigest" TEXT,
    ADD COLUMN "inputSummary" VARCHAR(500),
    ADD COLUMN "outputSummary" VARCHAR(500),
    ADD COLUMN "errorCode" TEXT,
    ADD COLUMN "redactionVersion" TEXT,
    ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "prometeo_tool_invocation_audit_executionId_key" ON "prometeo_tool_invocation_audit"("executionId");
CREATE INDEX "prometeo_tool_invocation_audit_tenantId_projectId_startedAt_idx" ON "prometeo_tool_invocation_audit"("tenantId", "projectId", "startedAt");
CREATE INDEX "prometeo_tool_invocation_audit_tenantId_runId_idx" ON "prometeo_tool_invocation_audit"("tenantId", "runId");
CREATE INDEX "prometeo_tool_invocation_audit_status_startedAt_idx" ON "prometeo_tool_invocation_audit"("status", "startedAt");
CREATE INDEX "prometeo_tool_invocation_audit_expiresAt_idx" ON "prometeo_tool_invocation_audit"("expiresAt");

-- AlterTable
ALTER TABLE "AgentApproval"
    ADD COLUMN "executionStatus" TEXT,
    ADD COLUMN "executionStartedAt" TIMESTAMP(3),
    ADD COLUMN "executionFinishedAt" TIMESTAMP(3),
    ADD COLUMN "executionError" VARCHAR(500),
    ADD COLUMN "executionId" TEXT;

-- CreateIndex
CREATE INDEX "AgentApproval_tenantId_status_executionStatus_idx" ON "AgentApproval"("tenantId", "status", "executionStatus");
