-- H05 (spec docs/specs/prometeo/tool-call-audit-lineage.spec.md): auditoría canónica por tool call y estado de
-- ejecución de las aprobaciones del copiloto.
-- Migración ADITIVA e IDEMPOTENTE: columnas NULABLES e índices, todo con IF NOT EXISTS. Sin backfill ni tocar filas.
-- El código anterior ignora estas columnas.
--
-- REPARACIÓN DE DERIVA (2026-10-06): la primera aplicación en producción falló con P3018 `relation
-- "prometeo_tool_invocation_audit" does not exist`. La migración original que la crea
-- (20260722000000_prometeo_tool_governance) figura como aplicada en `_prisma_migrations`, pero la tabla no existe en
-- esa base: es una "migración fantasma" (ver scripts/pre-migrate.mjs, repairPhantomMigrations). Por eso esta migración
-- primero asegura (CREATE ... IF NOT EXISTS) los objetos de la original (enum, `prometeo_proposed_action`,
-- `prometeo_tool_invocation_audit` e índices) y después añade las columnas nuevas. Donde la tabla ya existe, esa parte
-- es un no-op. Postgres ejecuta el script en una transacción: el intento fallido no dejó nada a medias.
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

-- ── Reparación de deriva: objetos de 20260722000000_prometeo_tool_governance, solo si faltan ──────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrometeoProposedActionStatus') THEN
        CREATE TYPE "PrometeoProposedActionStatus" AS ENUM ('PROPOSED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'BLOCKED', 'EXECUTED');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "prometeo_proposed_action" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvalPolicy" TEXT NOT NULL,
    "status" "PrometeoProposedActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "inputJson" JSONB NOT NULL,
    "requiredApprovals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prometeo_proposed_action_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "prometeo_tool_invocation_audit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockedReason" TEXT,
    "requestId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prometeo_tool_invocation_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prometeo_proposed_action_tenantId_status_createdAt_idx" ON "prometeo_proposed_action"("tenantId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_tenantId_occurredAt_idx" ON "prometeo_tool_invocation_audit"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_tenantId_status_occurredAt_idx" ON "prometeo_tool_invocation_audit"("tenantId", "status", "occurredAt");

-- ── H05: columnas e índices nuevos ───────────────────────────────────────────────────────────────────────────────────
-- AlterTable
ALTER TABLE "prometeo_tool_invocation_audit"
    ADD COLUMN IF NOT EXISTS "executionId" TEXT,
    ADD COLUMN IF NOT EXISTS "source" TEXT,
    ADD COLUMN IF NOT EXISTS "runId" TEXT,
    ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
    ADD COLUMN IF NOT EXISTS "threadId" TEXT,
    ADD COLUMN IF NOT EXISTS "projectId" TEXT,
    ADD COLUMN IF NOT EXISTS "agentId" TEXT,
    ADD COLUMN IF NOT EXISTS "approvalId" TEXT,
    ADD COLUMN IF NOT EXISTS "proposedActionId" TEXT,
    ADD COLUMN IF NOT EXISTS "policyVersion" TEXT,
    ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "durationMs" INTEGER,
    ADD COLUMN IF NOT EXISTS "inputDigest" TEXT,
    ADD COLUMN IF NOT EXISTS "outputDigest" TEXT,
    ADD COLUMN IF NOT EXISTS "inputSummary" VARCHAR(500),
    ADD COLUMN IF NOT EXISTS "outputSummary" VARCHAR(500),
    ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
    ADD COLUMN IF NOT EXISTS "redactionVersion" TEXT,
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_executionId_key" ON "prometeo_tool_invocation_audit"("executionId");
CREATE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_tenantId_projectId_startedAt_idx" ON "prometeo_tool_invocation_audit"("tenantId", "projectId", "startedAt");
CREATE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_tenantId_runId_idx" ON "prometeo_tool_invocation_audit"("tenantId", "runId");
CREATE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_status_startedAt_idx" ON "prometeo_tool_invocation_audit"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "prometeo_tool_invocation_audit_expiresAt_idx" ON "prometeo_tool_invocation_audit"("expiresAt");

-- AlterTable
ALTER TABLE "AgentApproval"
    ADD COLUMN IF NOT EXISTS "executionStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "executionStartedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "executionFinishedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "executionError" VARCHAR(500),
    ADD COLUMN IF NOT EXISTS "executionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentApproval_tenantId_status_executionStatus_idx" ON "AgentApproval"("tenantId", "status", "executionStatus");
