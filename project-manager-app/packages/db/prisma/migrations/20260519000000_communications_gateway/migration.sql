-- Extend notifications with WhatsApp as a first-class delivery channel.
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- Communications / Channel Gateway
CREATE TYPE "CommunicationProvider" AS ENUM ('WHATSAPP_CLOUD', 'OPENWA_LAB', 'SMS', 'EMAIL', 'WEB_CHAT');
CREATE TYPE "CommunicationThreadStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED', 'ARCHIVED');
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CommunicationMessageStatus" AS ENUM ('RECEIVED', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE "CommunicationChannelAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT,
    "provider" "CommunicationProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "phoneNumberId" TEXT,
    "displayPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "settingsJson" JSONB,
    "secretRef" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationChannelAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT,
    "channel" "CommunicationProvider" NOT NULL,
    "channelAccountId" TEXT,
    "externalThreadId" TEXT,
    "contactPhone" TEXT,
    "contactName" TEXT,
    "contactUserId" TEXT,
    "contractorLeadId" TEXT,
    "jobId" TEXT,
    "projectId" TEXT,
    "status" "CommunicationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "intent" TEXT,
    "source" TEXT NOT NULL DEFAULT 'communications',
    "lastMessageAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "provider" "CommunicationProvider" NOT NULL,
    "externalMessageId" TEXT,
    "senderUserId" TEXT,
    "contactPhone" TEXT,
    "body" TEXT,
    "mediaJson" JSONB,
    "rawPayloadJson" JSONB,
    "status" "CommunicationMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationMessageTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationProvider" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "category" TEXT NOT NULL DEFAULT 'utility',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "variablesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationMessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundDelivery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT,
    "notificationId" TEXT,
    "channel" "CommunicationProvider" NOT NULL,
    "recipientPhone" TEXT,
    "templateKey" TEXT,
    "body" TEXT NOT NULL,
    "payloadJson" JSONB,
    "status" "CommunicationMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "requestedByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgId" TEXT,
    "channel" "CommunicationProvider" NOT NULL,
    "externalContactId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "userId" TEXT,
    "contractorLeadId" TEXT,
    "displayName" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationChannelAccount_tenantId_provider_phoneNumberId_key" ON "CommunicationChannelAccount"("tenantId", "provider", "phoneNumberId");
CREATE INDEX "CommunicationChannelAccount_tenantId_provider_status_idx" ON "CommunicationChannelAccount"("tenantId", "provider", "status");
CREATE INDEX "CommunicationChannelAccount_tenantId_orgId_idx" ON "CommunicationChannelAccount"("tenantId", "orgId");

CREATE UNIQUE INDEX "ConversationThread_tenantId_channel_externalThreadId_key" ON "ConversationThread"("tenantId", "channel", "externalThreadId");
CREATE INDEX "ConversationThread_tenantId_status_lastMessageAt_idx" ON "ConversationThread"("tenantId", "status", "lastMessageAt");
CREATE INDEX "ConversationThread_tenantId_contactPhone_idx" ON "ConversationThread"("tenantId", "contactPhone");
CREATE INDEX "ConversationThread_tenantId_jobId_idx" ON "ConversationThread"("tenantId", "jobId");
CREATE INDEX "ConversationThread_tenantId_projectId_idx" ON "ConversationThread"("tenantId", "projectId");
CREATE INDEX "ConversationThread_tenantId_contractorLeadId_idx" ON "ConversationThread"("tenantId", "contractorLeadId");

CREATE UNIQUE INDEX "ConversationMessage_tenantId_provider_externalMessageId_key" ON "ConversationMessage"("tenantId", "provider", "externalMessageId");
CREATE INDEX "ConversationMessage_tenantId_threadId_createdAt_idx" ON "ConversationMessage"("tenantId", "threadId", "createdAt");
CREATE INDEX "ConversationMessage_tenantId_direction_createdAt_idx" ON "ConversationMessage"("tenantId", "direction", "createdAt");
CREATE INDEX "ConversationMessage_tenantId_status_createdAt_idx" ON "ConversationMessage"("tenantId", "status", "createdAt");

CREATE UNIQUE INDEX "CommunicationMessageTemplate_tenantId_channel_key_locale_key" ON "CommunicationMessageTemplate"("tenantId", "channel", "key", "locale");
CREATE INDEX "CommunicationMessageTemplate_tenantId_channel_status_idx" ON "CommunicationMessageTemplate"("tenantId", "channel", "status");

CREATE INDEX "OutboundDelivery_tenantId_channel_status_createdAt_idx" ON "OutboundDelivery"("tenantId", "channel", "status", "createdAt");
CREATE INDEX "OutboundDelivery_tenantId_recipientPhone_idx" ON "OutboundDelivery"("tenantId", "recipientPhone");
CREATE INDEX "OutboundDelivery_tenantId_threadId_idx" ON "OutboundDelivery"("tenantId", "threadId");
CREATE INDEX "OutboundDelivery_tenantId_notificationId_idx" ON "OutboundDelivery"("tenantId", "notificationId");

CREATE UNIQUE INDEX "ContactIdentity_tenantId_channel_externalContactId_key" ON "ContactIdentity"("tenantId", "channel", "externalContactId");
CREATE INDEX "ContactIdentity_tenantId_phone_idx" ON "ContactIdentity"("tenantId", "phone");
CREATE INDEX "ContactIdentity_tenantId_userId_idx" ON "ContactIdentity"("tenantId", "userId");
CREATE INDEX "ContactIdentity_tenantId_contractorLeadId_idx" ON "ContactIdentity"("tenantId", "contractorLeadId");

ALTER TABLE "CommunicationChannelAccount" ADD CONSTRAINT "CommunicationChannelAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationChannelAccount" ADD CONSTRAINT "CommunicationChannelAccount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationChannelAccount" ADD CONSTRAINT "CommunicationChannelAccount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "CommunicationChannelAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_contractorLeadId_fkey" FOREIGN KEY ("contractorLeadId") REFERENCES "ContractorLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CommunicationMessageTemplate" ADD CONSTRAINT "CommunicationMessageTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessageTemplate" ADD CONSTRAINT "CommunicationMessageTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contractorLeadId_fkey" FOREIGN KEY ("contractorLeadId") REFERENCES "ContractorLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
