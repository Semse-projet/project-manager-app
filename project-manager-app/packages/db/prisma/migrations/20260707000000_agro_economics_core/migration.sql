-- AlterTable
ALTER TABLE "AgroAnimal" ADD COLUMN     "estimatedValue" DECIMAL(12,2),
ADD COLUMN     "expectedSaleDate" TIMESTAMP(3),
ADD COLUMN     "expectedSalePrice" DECIMAL(12,2),
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "AgroAnimalGroup" ADD COLUMN     "estimatedValue" DECIMAL(12,2),
ADD COLUMN     "expectedSaleDate" TIMESTAMP(3),
ADD COLUMN     "expectedSalePrice" DECIMAL(12,2),
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "AgroProductionRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,4),
    "totalValue" DECIMAL(14,2),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroProductionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroSaleRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "buyerName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "saleWeight" DECIMAL(10,2),
    "salePrice" DECIMAL(14,2) NOT NULL,
    "freightCost" DECIMAL(12,2),
    "commission" DECIMAL(12,2),
    "paymentMethod" TEXT,
    "totalCostBasis" DECIMAL(14,2),
    "netProfit" DECIMAL(14,2),
    "marginPercent" DECIMAL(8,4),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroSaleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgroProductionRecord_farmId_idx" ON "AgroProductionRecord"("farmId");

-- CreateIndex
CREATE INDEX "AgroProductionRecord_targetType_targetId_idx" ON "AgroProductionRecord"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AgroProductionRecord_occurredAt_idx" ON "AgroProductionRecord"("occurredAt");

-- CreateIndex
CREATE INDEX "AgroProductionRecord_type_idx" ON "AgroProductionRecord"("type");

-- CreateIndex
CREATE INDEX "AgroSaleRecord_farmId_idx" ON "AgroSaleRecord"("farmId");

-- CreateIndex
CREATE INDEX "AgroSaleRecord_targetType_targetId_idx" ON "AgroSaleRecord"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AgroSaleRecord_occurredAt_idx" ON "AgroSaleRecord"("occurredAt");

-- AddForeignKey
ALTER TABLE "AgroProductionRecord" ADD CONSTRAINT "AgroProductionRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroSaleRecord" ADD CONSTRAINT "AgroSaleRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

