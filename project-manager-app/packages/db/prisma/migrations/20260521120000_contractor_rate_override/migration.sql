-- CreateTable
CREATE TABLE "ContractorRateOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "laborRatePerHr" DECIMAL(8,2) NOT NULL,
    "materialMarkup" DECIMAL(5,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorRateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorRateOverride_userId_key" ON "ContractorRateOverride"("userId");

-- AddForeignKey
ALTER TABLE "ContractorRateOverride" ADD CONSTRAINT "ContractorRateOverride_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
