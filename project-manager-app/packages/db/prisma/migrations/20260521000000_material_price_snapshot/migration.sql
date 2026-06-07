-- CreateTable
CREATE TABLE "MaterialPriceSnapshot" (
    "id" TEXT NOT NULL,
    "materialKey" TEXT NOT NULL,
    "blsSeriesId" TEXT,
    "source" TEXT NOT NULL,
    "pricePerUnit" DECIMAL(10,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "indexValue" DECIMAL(10,4),
    "basePrice" DECIMAL(10,4),
    "changeYoY" DECIMAL(6,4),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPriceSnapshot_materialKey_key" ON "MaterialPriceSnapshot"("materialKey");

-- CreateIndex
CREATE INDEX "MaterialPriceSnapshot_materialKey_idx" ON "MaterialPriceSnapshot"("materialKey");

-- CreateIndex
CREATE INDEX "MaterialPriceSnapshot_source_idx" ON "MaterialPriceSnapshot"("source");

-- CreateIndex
CREATE INDEX "MaterialPriceSnapshot_validUntil_idx" ON "MaterialPriceSnapshot"("validUntil");
