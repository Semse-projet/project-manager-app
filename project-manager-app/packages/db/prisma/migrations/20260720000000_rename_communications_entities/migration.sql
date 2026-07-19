-- Fase 2 de comunicaciones: renombra ConversationThread -> CommunicationThread y
-- ConversationMessage -> Communication, alineando nombres con la arquitectura unificada.

-- ── ConversationThread -> CommunicationThread ───────────────────────────────────
ALTER TABLE "ConversationThread" RENAME TO "CommunicationThread";

-- Primary key
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_pkey" TO "CommunicationThread_pkey";

-- Foreign keys on CommunicationThread
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_tenantId_fkey" TO "CommunicationThread_tenantId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_orgId_fkey" TO "CommunicationThread_orgId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_channelAccountId_fkey" TO "CommunicationThread_channelAccountId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_contactUserId_fkey" TO "CommunicationThread_contactUserId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_assignedToUserId_fkey" TO "CommunicationThread_assignedToUserId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_contractorLeadId_fkey" TO "CommunicationThread_contractorLeadId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_jobId_fkey" TO "CommunicationThread_jobId_fkey";
ALTER TABLE "CommunicationThread" RENAME CONSTRAINT "ConversationThread_projectId_fkey" TO "CommunicationThread_projectId_fkey";

-- Indexes on CommunicationThread
ALTER INDEX "ConversationThread_tenantId_channel_externalThreadId_key" RENAME TO "CommunicationThread_tenantId_channel_externalThreadId_key";
ALTER INDEX "ConversationThread_tenantId_status_lastMessageAt_idx" RENAME TO "CommunicationThread_tenantId_status_lastMessageAt_idx";
ALTER INDEX "ConversationThread_tenantId_contactPhone_idx" RENAME TO "CommunicationThread_tenantId_contactPhone_idx";
ALTER INDEX "ConversationThread_tenantId_jobId_idx" RENAME TO "CommunicationThread_tenantId_jobId_idx";
ALTER INDEX "ConversationThread_tenantId_projectId_idx" RENAME TO "CommunicationThread_tenantId_projectId_idx";
ALTER INDEX "ConversationThread_tenantId_contractorLeadId_idx" RENAME TO "CommunicationThread_tenantId_contractorLeadId_idx";

-- ── ConversationMessage -> Communication ────────────────────────────────────────
ALTER TABLE "ConversationMessage" RENAME TO "Communication";

-- Primary key
ALTER TABLE "Communication" RENAME CONSTRAINT "ConversationMessage_pkey" TO "Communication_pkey";

-- Foreign keys on Communication
ALTER TABLE "Communication" RENAME CONSTRAINT "ConversationMessage_tenantId_fkey" TO "Communication_tenantId_fkey";
ALTER TABLE "Communication" RENAME CONSTRAINT "ConversationMessage_threadId_fkey" TO "Communication_threadId_fkey";
ALTER TABLE "Communication" RENAME CONSTRAINT "ConversationMessage_senderUserId_fkey" TO "Communication_senderUserId_fkey";

-- Indexes on Communication
ALTER INDEX "ConversationMessage_tenantId_provider_externalMessageId_key" RENAME TO "Communication_tenantId_provider_externalMessageId_key";
ALTER INDEX "ConversationMessage_tenantId_threadId_createdAt_idx" RENAME TO "Communication_tenantId_threadId_createdAt_idx";
ALTER INDEX "ConversationMessage_tenantId_direction_createdAt_idx" RENAME TO "Communication_tenantId_direction_createdAt_idx";
ALTER INDEX "ConversationMessage_tenantId_status_createdAt_idx" RENAME TO "Communication_tenantId_status_createdAt_idx";
