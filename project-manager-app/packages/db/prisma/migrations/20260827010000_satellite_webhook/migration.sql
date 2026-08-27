CREATE TABLE "SatelliteWebhook" (
    "id" TEXT NOT NULL,
    "satelliteTokenId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secretCiphertext" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "secretTag" TEXT NOT NULL,
    "secretKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SatelliteWebhook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SatelliteWebhook_satelliteTokenId_url_key"
    ON "SatelliteWebhook"("satelliteTokenId", "url");
CREATE INDEX "SatelliteWebhook_satelliteTokenId_status_idx"
    ON "SatelliteWebhook"("satelliteTokenId", "status");
CREATE INDEX "SatelliteWebhook_status_idx"
    ON "SatelliteWebhook"("status");

ALTER TABLE "SatelliteWebhook"
    ADD CONSTRAINT "SatelliteWebhook_satelliteTokenId_fkey"
    FOREIGN KEY ("satelliteTokenId") REFERENCES "SatelliteToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
