-- CreateEnum
CREATE TYPE "ObservationPromotionStatus" AS ENUM ('PENDING', 'PROMOTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Observation" ADD COLUMN     "promotedAt" TIMESTAMP(3),
ADD COLUMN     "promotedByUserId" TEXT,
ADD COLUMN     "promotionReason" TEXT,
ADD COLUMN     "promotionStatus" "ObservationPromotionStatus" NOT NULL DEFAULT 'PENDING';
