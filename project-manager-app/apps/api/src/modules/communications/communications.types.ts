import type {
  CommunicationMessageStatus,
  CommunicationProvider,
  CommunicationThreadStatus,
} from "@prisma/client";

export type CommunicationsActor = {
  tenantId: string;
  orgId: string;
  userId: string;
};

export type CommunicationThreadRecord = {
  id: string;
  tenantId: string;
  orgId: string | null;
  channel: CommunicationProvider;
  channelAccountId: string | null;
  externalThreadId: string | null;
  contactPhone: string | null;
  contactName: string | null;
  contactUserId: string | null;
  contractorLeadId: string | null;
  jobId: string | null;
  projectId: string | null;
  status: CommunicationThreadStatus;
  assignedToUserId: string | null;
  intent: string | null;
  source: string;
  lastMessageAt: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationMessageRecord = {
  id: string;
  tenantId: string;
  threadId: string;
  direction: "INBOUND" | "OUTBOUND";
  provider: CommunicationProvider;
  externalMessageId: string | null;
  senderUserId: string | null;
  contactPhone: string | null;
  body: string | null;
  mediaJson: Record<string, unknown>[] | null;
  rawPayloadJson: Record<string, unknown> | null;
  status: CommunicationMessageStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type InboundCommunicationMessage = {
  channel: CommunicationProvider;
  externalThreadId?: string;
  externalMessageId?: string;
  contactPhone: string;
  contactName?: string;
  body?: string;
  media?: Record<string, unknown>[];
  rawPayload?: Record<string, unknown>;
  receivedAt?: string;
  jobId?: string;
  projectId?: string;
  contractorLeadId?: string;
};

export type SendCommunicationMessage = {
  channel: CommunicationProvider;
  threadId?: string;
  recipientPhone?: string;
  templateKey?: string;
  body: string;
  payload?: Record<string, unknown>;
  jobId?: string;
  projectId?: string;
  contractorLeadId?: string;
};
