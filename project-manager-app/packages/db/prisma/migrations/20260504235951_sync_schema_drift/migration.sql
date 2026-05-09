-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CHANGES', 'ESCALATE_DISPUTE');

-- CreateEnum
CREATE TYPE "PolicyAction" AS ENUM ('ALLOW', 'BLOCK', 'REQUIRE', 'NOTIFY', 'ESCALATE', 'AUTO_RESOLVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "FieldUnitStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETE', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FactVisibility" AS ENUM ('TEAM', 'ORG', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ComplianceDocStatus" AS ENUM ('MISSING', 'PENDING', 'APPROVED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "MilestoneStatus" ADD VALUE 'AWAITING_REVIEW';

-- DropForeignKey
ALTER TABLE "DeveloperRuntimeApprovalStore" DROP CONSTRAINT "DeveloperRuntimeApprovalStore_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DeveloperRuntimeArtifactStore" DROP CONSTRAINT "DeveloperRuntimeArtifactStore_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DeveloperRuntimeLogStore" DROP CONSTRAINT "DeveloperRuntimeLogStore_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DeveloperRuntimeMissionStore" DROP CONSTRAINT "DeveloperRuntimeMissionStore_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DeveloperRuntimeValidationStore" DROP CONSTRAINT "DeveloperRuntimeValidationStore_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentChunk" DROP CONSTRAINT "DocumentChunk_documentId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentChunk" DROP CONSTRAINT "DocumentChunk_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PrometeoAsset" DROP CONSTRAINT "PrometeoAsset_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PrometeoDocument" DROP CONSTRAINT "PrometeoDocument_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "WorkOrder" DROP CONSTRAINT "WorkOrder_tenantId_fkey";

-- AlterTable
ALTER TABLE "AgentApproval" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "actionType" TEXT,
ADD COLUMN     "confidence" DECIMAL(4,3),
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "inputSummary" TEXT,
ADD COLUMN     "outputSummary" TEXT,
ADD COLUMN     "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "toolCallCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AgentRunIdempotency" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperRuntimeApprovalStore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperRuntimeMissionStore" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeveloperRuntimeSessionStore" ALTER COLUMN "selectedAgentsJson" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "evidenceBundleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reasonCode" TEXT,
ADD COLUMN     "resolutionType" TEXT;

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "aiQualityScore" DECIMAL(5,4),
ADD COLUMN     "geoLat" DECIMAL(10,7),
ADD COLUMN     "geoLng" DECIMAL(10,7),
ADD COLUMN     "validationStatus" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "policyProfileId" TEXT,
ADD COLUMN     "scopeSnapshot" JSONB,
ADD COLUMN     "urgency" TEXT;

-- AlterTable
ALTER TABLE "JobIncident" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "JobTask" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LodgingBooking" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MaterialRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "checklistSchema" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "requiredEvidenceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PrometeoAsset" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PrometeoDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrackerSession" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TravelAdvance" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TravelAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TravelExpense" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TravelSettlement" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN     "trustScore" DECIMAL(5,4) NOT NULL DEFAULT 0,
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'unverified';

-- AlterTable
ALTER TABLE "WorkOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkspaceMemoryEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refreshTokenHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneReview" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneReview_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "action" "PolicyAction" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldUnit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "status" "FieldUnitStatus" NOT NULL DEFAULT 'PENDING',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorklogEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fieldUnitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "doneToday" TEXT NOT NULL,
    "pendingNext" TEXT NOT NULL,
    "blockers" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorklogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeFact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL DEFAULT 0.7,
    "visibility" "FactVisibility" NOT NULL DEFAULT 'TEAM',
    "worklogId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactLink" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMilestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fieldUnitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2),
    "notes" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "procedure" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdFromRunId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDoc" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "ComplianceDocStatus" NOT NULL DEFAULT 'MISSING',
    "fileUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "jobType" TEXT,
    "description" TEXT,
    "budgetRange" TEXT,
    "urgency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "jobId" TEXT,
    "projectId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractorLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionControlIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "source" TEXT NOT NULL,
    "posture" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "alertIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionControlIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientOrgId" TEXT,
    "projectId" TEXT,
    "jobId" TEXT,
    "createdBy" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "lineItems" JSONB NOT NULL DEFAULT '[]',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "pdfUrl" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT,
    "milestoneId" TEXT,
    "jobId" TEXT,
    "invoiceId" TEXT,
    "submittedBy" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "vendor" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptUrl" TEXT,
    "receiptText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "bodyJson" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectArchive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "snapshotJson" JSONB NOT NULL,
    "financialJson" JSONB NOT NULL,
    "milestonesJson" JSONB NOT NULL,
    "contractorId" TEXT,
    "contractorOrgId" TEXT,
    "clientOrgId" TEXT,
    "totalValue" DECIMAL(12,2),
    "durationDays" INTEGER,
    "milestoneCount" INTEGER NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "disputeCount" INTEGER NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,

    CONSTRAINT "ProjectArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRiskScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "disputeRisk" DECIMAL(5,4) NOT NULL,
    "budgetOverrunRisk" DECIMAL(5,4) NOT NULL,
    "scheduleRisk" DECIMAL(5,4) NOT NULL,
    "factorsJson" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT,
    "displayName" TEXT NOT NULL,
    "completedProjects" INTEGER NOT NULL DEFAULT 0,
    "activeProjects" INTEGER NOT NULL DEFAULT 0,
    "totalManaged" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "onTimeRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "disputeRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "avgClientRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "specialties" JSONB NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "publicSlug" TEXT,
    "badgesJson" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "sessionId" TEXT,
    "flow" TEXT NOT NULL DEFAULT 'publish_job',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "city" TEXT,
    "locationType" TEXT,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "urgency" TEXT,
    "attachmentsExpected" BOOLEAN NOT NULL DEFAULT false,
    "publishedJobId" TEXT,
    "completion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftId" TEXT,
    "flow" TEXT,
    "pageRoute" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantActionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT,
    "draftId" TEXT,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_tenantId_userId_status_idx" ON "AuthSession"("tenantId", "userId", "status");

-- CreateIndex
CREATE INDEX "AuthSession_tenantId_orgId_status_idx" ON "AuthSession"("tenantId", "orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_status_expiresAt_idx" ON "PasswordResetToken"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "MilestoneReview_milestoneId_createdAt_idx" ON "MilestoneReview"("milestoneId", "createdAt");

-- CreateIndex
CREATE INDEX "MilestoneReview_reviewerId_createdAt_idx" ON "MilestoneReview"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_jobId_createdAt_idx" ON "Rating"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_fromUserId_createdAt_idx" ON "Rating"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Rating_toUserId_createdAt_idx" ON "Rating"("toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyRule_tenantId_category_enabled_priority_idx" ON "PolicyRule"("tenantId", "category", "enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_tenantId_key_key" ON "PolicyRule"("tenantId", "key");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_type_createdAt_idx" ON "Notification"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "FieldUnit_tenantId_status_idx" ON "FieldUnit"("tenantId", "status");

-- CreateIndex
CREATE INDEX "FieldUnit_projectId_idx" ON "FieldUnit"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldUnit_projectId_code_key" ON "FieldUnit"("projectId", "code");

-- CreateIndex
CREATE INDEX "WorklogEntry_tenantId_date_idx" ON "WorklogEntry"("tenantId", "date");

-- CreateIndex
CREATE INDEX "WorklogEntry_fieldUnitId_date_idx" ON "WorklogEntry"("fieldUnitId", "date");

-- CreateIndex
CREATE INDEX "KnowledgeFact_tenantId_subject_predicate_idx" ON "KnowledgeFact"("tenantId", "subject", "predicate");

-- CreateIndex
CREATE INDEX "KnowledgeFact_tenantId_createdAt_idx" ON "KnowledgeFact"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "FactLink_fromId_idx" ON "FactLink"("fromId");

-- CreateIndex
CREATE INDEX "FactLink_toId_idx" ON "FactLink"("toId");

-- CreateIndex
CREATE INDEX "FieldMilestone_fieldUnitId_status_idx" ON "FieldMilestone"("fieldUnitId", "status");

-- CreateIndex
CREATE INDEX "FieldMilestone_tenantId_idx" ON "FieldMilestone"("tenantId");

-- CreateIndex
CREATE INDEX "Vendor_tenantId_idx" ON "Vendor"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_tenantId_name_key" ON "Vendor"("tenantId", "name");

-- CreateIndex
CREATE INDEX "AgentSkill_tenantId_agentId_status_lastUsedAt_idx" ON "AgentSkill"("tenantId", "agentId", "status", "lastUsedAt");

-- CreateIndex
CREATE INDEX "AgentSkill_tenantId_category_status_idx" ON "AgentSkill"("tenantId", "category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_tenantId_agentId_name_key" ON "AgentSkill"("tenantId", "agentId", "name");

-- CreateIndex
CREATE INDEX "ComplianceDoc_vendorId_type_idx" ON "ComplianceDoc"("vendorId", "type");

-- CreateIndex
CREATE INDEX "ComplianceDoc_tenantId_idx" ON "ComplianceDoc"("tenantId");

-- CreateIndex
CREATE INDEX "ContractorLead_tenantId_orgId_status_createdAt_idx" ON "ContractorLead"("tenantId", "orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ContractorLead_tenantId_status_idx" ON "ContractorLead"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MissionControlIncident_tenantId_createdAt_idx" ON "MissionControlIncident"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "MissionControlIncident_severity_createdAt_idx" ON "MissionControlIncident"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_orgId_status_createdAt_idx" ON "Invoice"("tenantId", "orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_projectId_createdAt_idx" ON "Invoice"("tenantId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_clientOrgId_status_idx" ON "Invoice"("tenantId", "clientOrgId", "status");

-- CreateIndex
CREATE INDEX "ProjectExpense_tenantId_projectId_status_createdAt_idx" ON "ProjectExpense"("tenantId", "projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectExpense_tenantId_orgId_category_createdAt_idx" ON "ProjectExpense"("tenantId", "orgId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectExpense_tenantId_submittedBy_createdAt_idx" ON "ProjectExpense"("tenantId", "submittedBy", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentTemplate_tenantId_orgId_category_isActive_idx" ON "DocumentTemplate"("tenantId", "orgId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectArchive_projectId_key" ON "ProjectArchive"("projectId");

-- CreateIndex
CREATE INDEX "ProjectArchive_tenantId_archivedAt_idx" ON "ProjectArchive"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "ProjectArchive_contractorOrgId_archivedAt_idx" ON "ProjectArchive"("contractorOrgId", "archivedAt");

-- CreateIndex
CREATE INDEX "ProjectArchive_clientOrgId_archivedAt_idx" ON "ProjectArchive"("clientOrgId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRiskScore_projectId_key" ON "ProjectRiskScore"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRiskScore_tenantId_overallScore_idx" ON "ProjectRiskScore"("tenantId", "overallScore");

-- CreateIndex
CREATE INDEX "ProjectRiskScore_tenantId_disputeRisk_idx" ON "ProjectRiskScore"("tenantId", "disputeRisk");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalCredential_userId_key" ON "ProfessionalCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalCredential_publicSlug_key" ON "ProfessionalCredential"("publicSlug");

-- CreateIndex
CREATE INDEX "ProfessionalCredential_tenantId_trustScore_idx" ON "ProfessionalCredential"("tenantId", "trustScore");

-- CreateIndex
CREATE INDEX "ProfessionalCredential_tenantId_completedProjects_idx" ON "ProfessionalCredential"("tenantId", "completedProjects");

-- CreateIndex
CREATE INDEX "ProjectDraft_tenantId_createdBy_idx" ON "ProjectDraft"("tenantId", "createdBy");

-- CreateIndex
CREATE INDEX "ProjectDraft_tenantId_status_idx" ON "ProjectDraft"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ConversationSession_tenantId_userId_idx" ON "ConversationSession"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AssistantActionLog_tenantId_userId_idx" ON "AssistantActionLog"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AssistantActionLog_tenantId_draftId_idx" ON "AssistantActionLog"("tenantId", "draftId");

-- CreateIndex
CREATE INDEX "User_verificationStatus_riskLevel_idx" ON "User"("verificationStatus", "riskLevel");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneReview" ADD CONSTRAINT "MilestoneReview_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneReview" ADD CONSTRAINT "MilestoneReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldUnit" ADD CONSTRAINT "FieldUnit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldUnit" ADD CONSTRAINT "FieldUnit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorklogEntry" ADD CONSTRAINT "WorklogEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorklogEntry" ADD CONSTRAINT "WorklogEntry_fieldUnitId_fkey" FOREIGN KEY ("fieldUnitId") REFERENCES "FieldUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFact" ADD CONSTRAINT "KnowledgeFact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFact" ADD CONSTRAINT "KnowledgeFact_worklogId_fkey" FOREIGN KEY ("worklogId") REFERENCES "WorklogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactLink" ADD CONSTRAINT "FactLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "KnowledgeFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactLink" ADD CONSTRAINT "FactLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "KnowledgeFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMilestone" ADD CONSTRAINT "FieldMilestone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMilestone" ADD CONSTRAINT "FieldMilestone_fieldUnitId_fkey" FOREIGN KEY ("fieldUnitId") REFERENCES "FieldUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDoc" ADD CONSTRAINT "ComplianceDoc_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDoc" ADD CONSTRAINT "ComplianceDoc_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelAssignment" ADD CONSTRAINT "TravelAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrometeoDocument" ADD CONSTRAINT "PrometeoDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PrometeoDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrometeoAsset" ADD CONSTRAINT "PrometeoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorLead" ADD CONSTRAINT "ContractorLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DeveloperRuntimeApprovalStore_tenant_session_idx" RENAME TO "DeveloperRuntimeApprovalStore_tenantId_sessionId_createdAt_idx";

-- RenameIndex
ALTER INDEX "DeveloperRuntimeArtifactStore_tenant_session_idx" RENAME TO "DeveloperRuntimeArtifactStore_tenantId_sessionId_createdAt_idx";

-- RenameIndex
ALTER INDEX "DeveloperRuntimeLogStore_tenant_session_idx" RENAME TO "DeveloperRuntimeLogStore_tenantId_sessionId_occurredAt_idx";

-- RenameIndex
ALTER INDEX "DeveloperRuntimeMissionStore_tenant_session_idx" RENAME TO "DeveloperRuntimeMissionStore_tenantId_sessionId_idx";

-- RenameIndex
ALTER INDEX "DeveloperRuntimeSessionStore_tenant_repo_idx" RENAME TO "DeveloperRuntimeSessionStore_tenantId_repoId_startedAt_idx";

-- RenameIndex
ALTER INDEX "DeveloperRuntimeSessionStore_tenant_state_idx" RENAME TO "DeveloperRuntimeSessionStore_tenantId_state_startedAt_idx";

-- RenameIndex
ALTER INDEX "DeveloperRuntimeValidationStore_tenant_session_idx" RENAME TO "DeveloperRuntimeValidationStore_tenantId_sessionId_createdA_idx";
