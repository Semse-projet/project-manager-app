-- CreateTable: LaborRateSnapshot
CREATE TABLE "LaborRateSnapshot" (
    "id" TEXT NOT NULL,
    "tradeKey" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "meanWage" DECIMAL(10,2) NOT NULL,
    "hourlyMean" DECIMAL(10,2) NOT NULL,
    "multiplier" DECIMAL(6,4) NOT NULL,
    "sampleSize" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LocationCostIndex
CREATE TABLE "LocationCostIndex" (
    "id" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "materialMultiplier" DECIMAL(6,4) NOT NULL,
    "laborMultiplier" DECIMAL(6,4) NOT NULL,
    "dataSource" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationCostIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaborRateSnapshot_tradeKey_scopeType_key" ON "LaborRateSnapshot"("tradeKey", "scopeType");
CREATE INDEX "LaborRateSnapshot_tradeKey_idx" ON "LaborRateSnapshot"("tradeKey");
CREATE INDEX "LaborRateSnapshot_scopeType_idx" ON "LaborRateSnapshot"("scopeType");
CREATE INDEX "LaborRateSnapshot_validUntil_idx" ON "LaborRateSnapshot"("validUntil");

CREATE UNIQUE INDEX "LocationCostIndex_stateCode_key" ON "LocationCostIndex"("stateCode");
CREATE INDEX "LocationCostIndex_stateCode_idx" ON "LocationCostIndex"("stateCode");
CREATE INDEX "LocationCostIndex_validUntil_idx" ON "LocationCostIndex"("validUntil");
