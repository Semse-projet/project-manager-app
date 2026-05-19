import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CommunicationDirection,
  CommunicationMessageStatus,
  CommunicationProvider,
  CommunicationThreadStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type {
  CommunicationMessageRecord,
  CommunicationsActor,
  CommunicationThreadRecord,
  InboundCommunicationMessage,
  SendCommunicationMessage,
} from "./communications.types.js";

type ThreadRow = {
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
  lastMessageAt: Date | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type MessageRow = {
  id: string;
  tenantId: string;
  threadId: string;
  direction: CommunicationDirection;
  provider: CommunicationProvider;
  externalMessageId: string | null;
  senderUserId: string | null;
  contactPhone: string | null;
  body: string | null;
  mediaJson: Prisma.JsonValue | null;
  rawPayloadJson: Prisma.JsonValue | null;
  status: CommunicationMessageStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
};

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function jsonArray(value: Prisma.JsonValue | null): Record<string, unknown>[] | null {
  return Array.isArray(value) ? value as Record<string, unknown>[] : null;
}

function toThreadRecord(row: ThreadRow): CommunicationThreadRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    orgId: row.orgId,
    channel: row.channel,
    channelAccountId: row.channelAccountId,
    externalThreadId: row.externalThreadId,
    contactPhone: row.contactPhone,
    contactName: row.contactName,
    contactUserId: row.contactUserId,
    contractorLeadId: row.contractorLeadId,
    jobId: row.jobId,
    projectId: row.projectId,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    intent: row.intent,
    source: row.source,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    metadataJson: jsonObject(row.metadataJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageRecord(row: MessageRow): CommunicationMessageRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    threadId: row.threadId,
    direction: row.direction,
    provider: row.provider,
    externalMessageId: row.externalMessageId,
    senderUserId: row.senderUserId,
    contactPhone: row.contactPhone,
    body: row.body,
    mediaJson: jsonArray(row.mediaJson),
    rawPayloadJson: jsonObject(row.rawPayloadJson),
    status: row.status,
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class CommunicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createChannelAccount(actor: CommunicationsActor, input: {
    provider: CommunicationProvider;
    label: string;
    externalAccountId?: string;
    phoneNumberId?: string;
    displayPhone?: string;
    status?: string;
    settingsJson?: Record<string, unknown>;
    secretRef?: string;
  }) {
    return this.prisma.communicationChannelAccount.create({
      data: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        provider: input.provider,
        label: input.label,
        externalAccountId: input.externalAccountId ?? null,
        phoneNumberId: input.phoneNumberId ?? null,
        displayPhone: input.displayPhone ?? null,
        status: input.status ?? "active",
        settingsJson: input.settingsJson ? json(input.settingsJson) : Prisma.JsonNull,
        secretRef: input.secretRef ?? null,
        createdByUserId: actor.userId,
      },
    });
  }

  async listChannelAccounts(actor: Pick<CommunicationsActor, "tenantId" | "orgId">) {
    return this.prisma.communicationChannelAccount.findMany({
      where: { tenantId: actor.tenantId, orgId: actor.orgId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listThreads(input: {
    tenantId: string;
    orgId?: string;
    status?: CommunicationThreadStatus;
    limit?: number;
    offset?: number;
  }): Promise<CommunicationThreadRecord[]> {
    const rows = await this.prisma.conversationThread.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.orgId ? { orgId: input.orgId } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
    });
    return (rows as ThreadRow[]).map(toThreadRecord);
  }

  async getThread(input: { tenantId: string; threadId: string }): Promise<CommunicationThreadRecord> {
    const row = await this.prisma.conversationThread.findFirst({
      where: { id: input.threadId, tenantId: input.tenantId },
    });
    if (!row) throw new NotFoundException(`Conversation thread '${input.threadId}' not found`);
    return toThreadRecord(row as ThreadRow);
  }

  async listMessages(input: {
    tenantId: string;
    threadId: string;
    limit?: number;
    offset?: number;
  }): Promise<CommunicationMessageRecord[]> {
    await this.getThread({ tenantId: input.tenantId, threadId: input.threadId });
    const rows = await this.prisma.conversationMessage.findMany({
      where: { tenantId: input.tenantId, threadId: input.threadId },
      orderBy: { createdAt: "asc" },
      take: input.limit ?? 100,
      skip: input.offset ?? 0,
    });
    return (rows as MessageRow[]).map(toMessageRecord);
  }

  async findThreadForOutbound(input: {
    tenantId: string;
    threadId?: string;
    channel: CommunicationProvider;
    recipientPhone?: string;
    jobId?: string;
    projectId?: string;
    contractorLeadId?: string;
  }): Promise<CommunicationThreadRecord | null> {
    if (input.threadId) {
      return this.getThread({ tenantId: input.tenantId, threadId: input.threadId });
    }

    if (!input.recipientPhone) return null;

    const row = await this.prisma.conversationThread.findFirst({
      where: {
        tenantId: input.tenantId,
        channel: input.channel,
        contactPhone: input.recipientPhone,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.contractorLeadId ? { contractorLeadId: input.contractorLeadId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return row ? toThreadRecord(row as ThreadRow) : null;
  }

  async upsertThreadFromInbound(actor: CommunicationsActor, input: InboundCommunicationMessage): Promise<CommunicationThreadRecord> {
    const externalThreadId = input.externalThreadId ?? input.contactPhone;
    const existing = await this.prisma.conversationThread.findUnique({
      where: {
        tenantId_channel_externalThreadId: {
          tenantId: actor.tenantId,
          channel: input.channel,
          externalThreadId,
        },
      },
    });

    const data = {
      orgId: actor.orgId,
      contactPhone: input.contactPhone,
      contactName: input.contactName ?? null,
      jobId: input.jobId ?? existing?.jobId ?? null,
      projectId: input.projectId ?? existing?.projectId ?? null,
      contractorLeadId: input.contractorLeadId ?? existing?.contractorLeadId ?? null,
      status: CommunicationThreadStatus.OPEN,
      lastMessageAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
    };

    const row = existing
      ? await this.prisma.conversationThread.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.conversationThread.create({
          data: {
            tenantId: actor.tenantId,
            channel: input.channel,
            externalThreadId,
            source: "whatsapp",
            ...data,
          },
        });

    return toThreadRecord(row as ThreadRow);
  }

  async createOutboundThread(actor: CommunicationsActor, input: SendCommunicationMessage): Promise<CommunicationThreadRecord> {
    if (!input.recipientPhone) {
      throw new NotFoundException("recipientPhone is required when threadId is not provided");
    }

    const row = await this.prisma.conversationThread.create({
      data: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        channel: input.channel,
        externalThreadId: input.recipientPhone,
        contactPhone: input.recipientPhone,
        jobId: input.jobId ?? null,
        projectId: input.projectId ?? null,
        contractorLeadId: input.contractorLeadId ?? null,
        status: CommunicationThreadStatus.OPEN,
        source: "manual_outbound",
        lastMessageAt: new Date(),
      },
    });

    return toThreadRecord(row as ThreadRow);
  }

  async appendInboundMessage(input: {
    actor: CommunicationsActor;
    threadId: string;
    message: InboundCommunicationMessage;
  }): Promise<CommunicationMessageRecord> {
    if (input.message.externalMessageId) {
      const existing = await this.prisma.conversationMessage.findUnique({
        where: {
          tenantId_provider_externalMessageId: {
            tenantId: input.actor.tenantId,
            provider: input.message.channel,
            externalMessageId: input.message.externalMessageId,
          },
        },
      });
      if (existing) return toMessageRecord(existing as MessageRow);
    }

    const row = await this.prisma.conversationMessage.create({
      data: {
        tenantId: input.actor.tenantId,
        threadId: input.threadId,
        direction: CommunicationDirection.INBOUND,
        provider: input.message.channel,
        externalMessageId: input.message.externalMessageId ?? null,
        contactPhone: input.message.contactPhone,
        body: input.message.body ?? null,
        mediaJson: input.message.media ? json(input.message.media) : Prisma.JsonNull,
        rawPayloadJson: input.message.rawPayload ? json(input.message.rawPayload) : Prisma.JsonNull,
        status: CommunicationMessageStatus.RECEIVED,
      },
    });

    await this.prisma.conversationThread.update({
      where: { id: input.threadId },
      data: { lastMessageAt: new Date(), updatedAt: new Date() },
    });

    return toMessageRecord(row as MessageRow);
  }

  async appendOutboundMessage(input: {
    actor: CommunicationsActor;
    threadId: string;
    message: SendCommunicationMessage;
    externalMessageId?: string;
    status: CommunicationMessageStatus;
  }): Promise<CommunicationMessageRecord> {
    const now = new Date();
    const row = await this.prisma.conversationMessage.create({
      data: {
        tenantId: input.actor.tenantId,
        threadId: input.threadId,
        direction: CommunicationDirection.OUTBOUND,
        provider: input.message.channel,
        externalMessageId: input.externalMessageId ?? null,
        senderUserId: input.actor.userId,
        contactPhone: input.message.recipientPhone ?? null,
        body: input.message.body,
        rawPayloadJson: input.message.payload ? json(input.message.payload) : Prisma.JsonNull,
        status: input.status,
        sentAt: input.status === CommunicationMessageStatus.SENT ? now : null,
      },
    });

    await this.prisma.conversationThread.update({
      where: { id: input.threadId },
      data: { lastMessageAt: now, updatedAt: now },
    });

    return toMessageRecord(row as MessageRow);
  }

  async createOutboundDelivery(input: {
    actor: CommunicationsActor;
    threadId?: string;
    notificationId?: string;
    message: SendCommunicationMessage;
  }) {
    return this.prisma.outboundDelivery.create({
      data: {
        tenantId: input.actor.tenantId,
        threadId: input.threadId ?? null,
        notificationId: input.notificationId ?? null,
        channel: input.message.channel,
        recipientPhone: input.message.recipientPhone ?? null,
        templateKey: input.message.templateKey ?? null,
        body: input.message.body,
        payloadJson: input.message.payload ? json(input.message.payload) : Prisma.JsonNull,
        status: CommunicationMessageStatus.QUEUED,
        requestedByUserId: input.actor.userId,
      },
    });
  }

  async markOutboundDelivery(input: {
    deliveryId: string;
    providerMessageId?: string;
    status: CommunicationMessageStatus;
    error?: string;
  }) {
    return this.prisma.outboundDelivery.update({
      where: { id: input.deliveryId },
      data: {
        providerMessageId: input.providerMessageId ?? null,
        status: input.status,
        error: input.error ?? null,
        sentAt: input.status === CommunicationMessageStatus.SENT ? new Date() : null,
      },
    });
  }

  async updateDeliveryStatusByProviderMessageId(input: {
    providerMessageId: string;
    status: CommunicationMessageStatus;
  }) {
    await this.prisma.outboundDelivery.updateMany({
      where: { providerMessageId: input.providerMessageId },
      data: { status: input.status },
    });
    await this.prisma.conversationMessage.updateMany({
      where: { externalMessageId: input.providerMessageId },
      data: { status: input.status },
    });
  }

  async upsertContactIdentity(input: {
    actor: CommunicationsActor;
    channel: CommunicationProvider;
    phone: string;
    displayName?: string;
    externalContactId?: string;
    contractorLeadId?: string;
    userId?: string;
    metadataJson?: Record<string, unknown>;
  }) {
    if (input.externalContactId) {
      return this.prisma.contactIdentity.upsert({
        where: {
          tenantId_channel_externalContactId: {
            tenantId: input.actor.tenantId,
            channel: input.channel,
            externalContactId: input.externalContactId,
          },
        },
        update: {
          phone: input.phone,
          displayName: input.displayName ?? null,
          contractorLeadId: input.contractorLeadId ?? undefined,
          userId: input.userId ?? undefined,
          metadataJson: input.metadataJson ? json(input.metadataJson) : undefined,
        },
        create: {
          tenantId: input.actor.tenantId,
          orgId: input.actor.orgId,
          channel: input.channel,
          externalContactId: input.externalContactId,
          phone: input.phone,
          displayName: input.displayName ?? null,
          contractorLeadId: input.contractorLeadId ?? null,
          userId: input.userId ?? null,
          metadataJson: input.metadataJson ? json(input.metadataJson) : Prisma.JsonNull,
        },
      });
    }

    const existing = await this.prisma.contactIdentity.findFirst({
      where: { tenantId: input.actor.tenantId, channel: input.channel, phone: input.phone },
    });
    if (existing) {
      return this.prisma.contactIdentity.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName ?? existing.displayName,
          contractorLeadId: input.contractorLeadId ?? existing.contractorLeadId,
          userId: input.userId ?? existing.userId,
          metadataJson: input.metadataJson ? json(input.metadataJson) : undefined,
        },
      });
    }

    return this.prisma.contactIdentity.create({
      data: {
        tenantId: input.actor.tenantId,
        orgId: input.actor.orgId,
        channel: input.channel,
        phone: input.phone,
        displayName: input.displayName ?? null,
        contractorLeadId: input.contractorLeadId ?? null,
        userId: input.userId ?? null,
        metadataJson: input.metadataJson ? json(input.metadataJson) : Prisma.JsonNull,
      },
    });
  }

  async findUserByPhone(input: { tenantId: string; phone: string }) {
    return this.prisma.user.findFirst({
      where: {
        phone: input.phone,
        memberships: { some: { org: { tenantId: input.tenantId } } },
      },
      select: { id: true, phone: true },
    });
  }

  async findNotificationRecipient(input: { tenantId: string; userId: string }) {
    return this.prisma.user.findFirst({
      where: {
        id: input.userId,
        memberships: { some: { org: { tenantId: input.tenantId } } },
      },
      select: {
        id: true,
        phone: true,
        memberships: {
          where: { org: { tenantId: input.tenantId } },
          take: 1,
          select: { orgId: true },
        },
      },
    });
  }

  async findContractorLeadByPhone(input: { tenantId: string; phone: string }) {
    return this.prisma.contractorLead.findFirst({
      where: { tenantId: input.tenantId, phone: input.phone },
      orderBy: { updatedAt: "desc" },
    });
  }

  async linkThread(input: {
    tenantId: string;
    threadId: string;
    contractorLeadId?: string;
    jobId?: string;
    projectId?: string;
    metadataJson?: Record<string, unknown>;
  }): Promise<CommunicationThreadRecord> {
    const row = await this.prisma.conversationThread.update({
      where: { id: input.threadId },
      data: {
        contractorLeadId: input.contractorLeadId,
        jobId: input.jobId,
        projectId: input.projectId,
        metadataJson: input.metadataJson ? json(input.metadataJson) : undefined,
      },
    });
    return toThreadRecord(row as ThreadRow);
  }

  async updateThread(input: {
    tenantId: string;
    threadId: string;
    status?: CommunicationThreadStatus;
    assignedToUserId?: string;
    intent?: string;
  }): Promise<CommunicationThreadRecord> {
    const row = await this.prisma.conversationThread.update({
      where: { id: input.threadId, tenantId: input.tenantId },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.assignedToUserId !== undefined ? { assignedToUserId: input.assignedToUserId } : {}),
        ...(input.intent !== undefined ? { intent: input.intent } : {}),
      },
    });
    return toThreadRecord(row as ThreadRow);
  }

  async createTemplate(actor: CommunicationsActor, input: {
    key: string;
    name: string;
    channel: CommunicationProvider;
    locale: string;
    category: string;
    body: string;
    status: string;
    variablesJson?: Record<string, unknown>;
  }) {
    return this.prisma.communicationMessageTemplate.upsert({
      where: {
        tenantId_channel_key_locale: {
          tenantId: actor.tenantId,
          channel: input.channel,
          key: input.key,
          locale: input.locale,
        },
      },
      update: {
        name: input.name,
        category: input.category,
        body: input.body,
        status: input.status,
        variablesJson: input.variablesJson ? json(input.variablesJson) : Prisma.JsonNull,
      },
      create: {
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        key: input.key,
        name: input.name,
        channel: input.channel,
        locale: input.locale,
        category: input.category,
        body: input.body,
        status: input.status,
        variablesJson: input.variablesJson ? json(input.variablesJson) : Prisma.JsonNull,
      },
    });
  }

  async listTemplates(actor: Pick<CommunicationsActor, "tenantId" | "orgId">) {
    return this.prisma.communicationMessageTemplate.findMany({
      where: { tenantId: actor.tenantId, orgId: actor.orgId },
      orderBy: [{ channel: "asc" }, { key: "asc" }],
    });
  }
}
