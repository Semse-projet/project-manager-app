-- AlterTable
ALTER TABLE "AgentWorkPlan" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AiInteractionLog" ADD COLUMN     "actorRoles" TEXT,
ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "policyDecision" TEXT,
ADD COLUMN     "privacyLevel" TEXT;
