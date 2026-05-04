-- AlterTable: AgentWorkPlan — add metaJson, cancelledAt, cancelledBy
ALTER TABLE "AgentWorkPlan"
  ADD COLUMN IF NOT EXISTS "metaJson"    JSONB,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
