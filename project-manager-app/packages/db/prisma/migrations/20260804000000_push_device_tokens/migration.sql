-- Push notification tokens per user+device (apps/mobile Fase 2).
-- Registered via POST /v1/push/register (apps/api/src/modules/push-notifications).

CREATE TABLE "PushDeviceToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PushDeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDeviceToken_userId_deviceId_key" ON "PushDeviceToken"("userId", "deviceId");

CREATE INDEX "PushDeviceToken_tenantId_userId_idx" ON "PushDeviceToken"("tenantId", "userId");

ALTER TABLE "PushDeviceToken" ADD CONSTRAINT "PushDeviceToken_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
