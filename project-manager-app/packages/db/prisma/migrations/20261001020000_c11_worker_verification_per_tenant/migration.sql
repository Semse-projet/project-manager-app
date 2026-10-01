-- C11: verificación de trabajadores POR TENANT (spec docs/specs/trust/worker-verification-tenant.spec.md).
-- Migración ADITIVA: 3 tablas nuevas, sin tocar tablas existentes ni datos.
-- No hay backfill: el estado global legado de "User"."verificationStatus" se sigue leyendo solo como
-- compatibilidad temporal cuando no existe fila por tenant.
--
-- ROLLBACK (seguro mientras nadie dependa de las tablas):
--   DROP TABLE "WorkerVerificationEvent";
--   DROP TABLE "WorkerVerificationChallenge";
--   DROP TABLE "WorkerVerification";
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261001020000_c11_worker_verification_per_tenant';

-- CreateTable
CREATE TABLE "WorkerVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerVerificationChallenge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerVerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerVerificationEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "actorUserId" TEXT,
    "metadataJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerVerification_tenantId_status_idx" ON "WorkerVerification"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerVerification_tenantId_userId_key" ON "WorkerVerification"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerVerificationChallenge_nonceHash_key" ON "WorkerVerificationChallenge"("nonceHash");

-- CreateIndex
CREATE INDEX "WorkerVerificationChallenge_tenantId_userId_createdAt_idx" ON "WorkerVerificationChallenge"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerVerificationEvent_tenantId_userId_occurredAt_idx" ON "WorkerVerificationEvent"("tenantId", "userId", "occurredAt");

