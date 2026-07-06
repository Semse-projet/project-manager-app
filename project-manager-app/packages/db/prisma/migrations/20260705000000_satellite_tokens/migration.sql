-- SAT-001 — Satellite tokens (docs/specs/satellites/SAT-001-semse-sdk.spec.md)
-- Credenciales por satélite con scopes mínimos. Solo se guarda el hash del token.

-- CreateTable
CREATE TABLE "SatelliteToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SatelliteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SatelliteToken_name_key" ON "SatelliteToken"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SatelliteToken_tokenHash_key" ON "SatelliteToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SatelliteToken_status_idx" ON "SatelliteToken"("status");
