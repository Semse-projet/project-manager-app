-- Pre-existing drift between committed schema.prisma and the migration
-- history, unrelated to any feature in this batch — surfaced by `prisma
-- migrate dev` while adding the F10 originator models. Split out into its
-- own migration following this repo's established precedent
-- (20260504235951_sync_schema_drift). Not reviewed line-by-line for intent;
-- flagged separately for the payments/agro module owners.

-- DropForeignKey
ALTER TABLE "AgroComplianceCheck" DROP CONSTRAINT "AgroComplianceCheck_farmId_fkey";

-- DropForeignKey
ALTER TABLE "AgroCropCycle" DROP CONSTRAINT "AgroCropCycle_farmId_fkey";

-- DropForeignKey
ALTER TABLE "AgroCropCycle" DROP CONSTRAINT "AgroCropCycle_fieldUnitId_fkey";

-- DropForeignKey
ALTER TABLE "AgroCropCycle" DROP CONSTRAINT "AgroCropCycle_productionCycleId_fkey";

-- DropForeignKey
ALTER TABLE "AgroHarvestRecord" DROP CONSTRAINT "AgroHarvestRecord_cropCycleId_fkey";

-- DropForeignKey
ALTER TABLE "AgroHarvestRecord" DROP CONSTRAINT "AgroHarvestRecord_farmId_fkey";

-- DropForeignKey
ALTER TABLE "AgroInputApplication" DROP CONSTRAINT "AgroInputApplication_cropCycleId_fkey";

-- DropForeignKey
ALTER TABLE "AgroInputApplication" DROP CONSTRAINT "AgroInputApplication_farmId_fkey";

-- DropForeignKey
ALTER TABLE "AgroProductionCycle" DROP CONSTRAINT "AgroProductionCycle_farmId_fkey";

-- DropForeignKey
ALTER TABLE "AgroTraceabilityEvent" DROP CONSTRAINT "AgroTraceabilityEvent_farmId_fkey";

-- DropForeignKey
ALTER TABLE "AgroTraceabilityEvent" DROP CONSTRAINT "AgroTraceabilityEvent_productionCycleId_fkey";

-- DropForeignKey
ALTER TABLE "MilestoneEvidenceItem" DROP CONSTRAINT "MilestoneEvidenceItem_milestoneId_fkey";

-- DropIndex
DROP INDEX "AlgorithmRun_trade_idx";

-- DropIndex
DROP INDEX "ChangeOrderCandidate_status_idx";

-- DropIndex
DROP INDEX "ChangeOrderCandidate_tenantId_idx";

-- DropIndex
DROP INDEX "Contract_helloSignRequestId_idx";

-- DropIndex
DROP INDEX "Milestone_paymentReadiness_idx";

-- DropIndex
DROP INDEX "MilestoneEvidenceItem_status_idx";

-- AlterTable
ALTER TABLE "AgroCropCycle" ALTER COLUMN "areaHectares" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "seedQuantityKg" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "AgroHarvestRecord" ALTER COLUMN "quantityKg" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "AgroInputApplication" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "AgroTraceabilityEvent" ALTER COLUMN "latitude" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "longitude" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "BuildOpsPlanVersion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChangeOrderCandidate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Evidence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobTask" ALTER COLUMN "domain" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MilestoneEvidenceItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MissionControlIncident" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "AgroAnimal_species_idx" ON "AgroAnimal"("species");

-- CreateIndex
CREATE INDEX "AlgorithmRun_trade_createdAt_idx" ON "AlgorithmRun"("trade", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeOrderCandidate_tenantId_status_idx" ON "ChangeOrderCandidate"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MilestoneEvidenceItem_milestoneId_status_idx" ON "MilestoneEvidenceItem"("milestoneId", "status");

-- AddForeignKey
ALTER TABLE "MilestoneEvidenceItem" ADD CONSTRAINT "MilestoneEvidenceItem_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroProductionCycle" ADD CONSTRAINT "AgroProductionCycle_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCropCycle" ADD CONSTRAINT "AgroCropCycle_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCropCycle" ADD CONSTRAINT "AgroCropCycle_productionCycleId_fkey" FOREIGN KEY ("productionCycleId") REFERENCES "AgroProductionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCropCycle" ADD CONSTRAINT "AgroCropCycle_fieldUnitId_fkey" FOREIGN KEY ("fieldUnitId") REFERENCES "AgroFarmUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroInputApplication" ADD CONSTRAINT "AgroInputApplication_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroInputApplication" ADD CONSTRAINT "AgroInputApplication_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "AgroCropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroHarvestRecord" ADD CONSTRAINT "AgroHarvestRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroHarvestRecord" ADD CONSTRAINT "AgroHarvestRecord_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "AgroCropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroTraceabilityEvent" ADD CONSTRAINT "AgroTraceabilityEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroTraceabilityEvent" ADD CONSTRAINT "AgroTraceabilityEvent_productionCycleId_fkey" FOREIGN KEY ("productionCycleId") REFERENCES "AgroProductionCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroComplianceCheck" ADD CONSTRAINT "AgroComplianceCheck_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
