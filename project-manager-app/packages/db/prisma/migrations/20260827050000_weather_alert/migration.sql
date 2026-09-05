-- CreateTable
CREATE TABLE "WeatherAlert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "probability" DECIMAL(5,2),
    "maxIntensity" DECIMAL(10,2),
    "affectedTrades" JSONB NOT NULL,
    "notCriticalFor" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tomorrow.io',
    "status" TEXT NOT NULL DEFAULT 'FORECAST',
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "autoHaltCreated" BOOLEAN NOT NULL DEFAULT false,
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherAlert_projectId_status_idx" ON "WeatherAlert"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherAlert_projectId_eventType_startTime_key" ON "WeatherAlert"("projectId", "eventType", "startTime");

-- AddForeignKey
ALTER TABLE "WeatherAlert" ADD CONSTRAINT "WeatherAlert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

