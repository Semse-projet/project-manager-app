-- BO-09 geofence-policy: tablas aditivas, sin backfill ni DML. No guarda coordenadas (OPEN-10).
CREATE TABLE "LocationPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ASK',
    "autoStartConsentedAt" TIMESTAMP(3),
    "autoStartRevokedAt" TIMESTAMP(3),
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeofenceEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "worksiteId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "accuracyBucket" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocationPreference_tenantId_userId_key" ON "LocationPreference"("tenantId", "userId");
CREATE UNIQUE INDEX "GeofenceEvent_tenantId_userId_eventId_key" ON "GeofenceEvent"("tenantId", "userId", "eventId");
CREATE INDEX "GeofenceEvent_tenantId_userId_createdAt_idx" ON "GeofenceEvent"("tenantId", "userId", "createdAt");
