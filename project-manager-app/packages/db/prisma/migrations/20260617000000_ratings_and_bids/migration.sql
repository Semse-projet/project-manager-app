-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "proOrgId" TEXT NOT NULL,
    "professionalUserId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "etaDays" INTEGER NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bid_jobId_status_idx" ON "Bid"("jobId", "status");

-- CreateIndex
CREATE INDEX "Bid_professionalUserId_status_idx" ON "Bid"("professionalUserId", "status");

-- CreateIndex
CREATE INDEX "Rating_jobId_createdAt_idx" ON "Rating"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_fromUserId_createdAt_idx" ON "Rating"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_toUserId_createdAt_idx" ON "Rating"("toUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_proOrgId_fkey" FOREIGN KEY ("proOrgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_professionalUserId_fkey" FOREIGN KEY ("professionalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add avgClientRating to ContractorProfile if column doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ContractorProfile' AND column_name = 'avgClientRating'
  ) THEN
    ALTER TABLE "ContractorProfile" ADD COLUMN "avgClientRating" DECIMAL(3,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
