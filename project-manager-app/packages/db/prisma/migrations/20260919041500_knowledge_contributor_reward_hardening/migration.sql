-- AlterTable
ALTER TABLE "ContributorReward" ADD COLUMN     "transferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ContributorReward_transferId_key" ON "ContributorReward"("transferId");
