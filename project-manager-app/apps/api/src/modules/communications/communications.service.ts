import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CommunicationMessageStatus,
  CommunicationProvider,
  CommunicationThreadStatus,
} from "@prisma/client";
import { ContractorService } from "../contractor/contractor.service.js";
import { SmartIntakeService } from "../smart-intake/smart-intake.service.js";
import { CommunicationsRepository } from "./communications.repository.js";
import type {
  CommunicationsActor,
  CommunicationThreadRecord,
  InboundCommunicationMessage,
  SendCommunicationMessage,
} from "./communications.types.js";
import { WhatsAppCloudAdapter } from "./providers/whatsapp-cloud.adapter.js";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

function isProjectLikeMessage(body: string | undefined): boolean {
  if (!body || body.trim().length < 10) return false;
  const normalized = body.toLowerCase();
  return [
    "remodel",
    "remodelar",
    "reparar",
    "arreglar",
    "constru",
    "pintar",
    "cocina",
    "baño",
    "bathroom",
    "kitchen",
    "floor",
    "puerta",
    "ventana",
    "siding",
    "demo",
  ].some((token) => normalized.includes(token));
}

function inferJobType(body: string | undefined): string | undefined {
  if (!body) return undefined;
  const normalized = body.toLowerCase();
  if (normalized.includes("baño") || normalized.includes("bathroom")) return "bathroom_remodel";
  if (normalized.includes("cocina") || normalized.includes("kitchen")) return "kitchen_remodel";
  if (normalized.includes("pint")) return "painting";
  if (normalized.includes("floor") || normalized.includes("piso")) return "flooring";
  if (normalized.includes("ventana") || normalized.includes("window")) return "windows_doors";
  if (normalized.includes("siding")) return "siding_exterior";
  if (normalized.includes("demo")) return "demolition";
  return undefined;
}

function mapProviderStatus(status: string): CommunicationMessageStatus {
  switch (status.toLowerCase()) {
    case "sent":
      return CommunicationMessageStatus.SENT;
    case "delivered":
      return CommunicationMessageStatus.DELIVERED;
    case "read":
      return CommunicationMessageStatus.READ;
    case "failed":
      return CommunicationMessageStatus.FAILED;
    default:
      return CommunicationMessageStatus.QUEUED;
  }
}

function getNestedString(value: Record<string, unknown> | null, path: string[]): string | undefined {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" ? cursor : undefined;
}

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly whatsapp: WhatsAppCloudAdapter,
    private readonly contractorService: ContractorService,
    private readonly smartIntakeService: SmartIntakeService,
    private readonly config: ConfigService,
  ) {}

  actorFromWebhookEnv(): CommunicationsActor {
    return {
      tenantId: this.config.get<string>("SEMSE_COMMUNICATIONS_TENANT_ID") ?? "tenant_default",
      orgId: this.config.get<string>("SEMSE_COMMUNICATIONS_ORG_ID") ?? "org_admin_001",
      userId: this.config.get<string>("SEMSE_COMMUNICATIONS_ACTOR_USER_ID") ?? "usr_admin_001",
    };
  }

  verifyWhatsAppWebhook(input: { mode?: string; token?: string; challenge?: string }): string {
    if (input.mode !== "subscribe") {
      throw new BadRequestException("Unsupported WhatsApp webhook verification mode");
    }

    const verifyToken = this.whatsapp.verifyToken;
    if (!verifyToken || input.token !== verifyToken) {
      throw new ForbiddenException("Invalid WhatsApp webhook verify token");
    }

    return input.challenge ?? "";
  }

  async createChannelAccount(actor: CommunicationsActor, input: Parameters<CommunicationsRepository["createChannelAccount"]>[1]) {
    return this.repository.createChannelAccount(actor, input);
  }

  async listChannelAccounts(actor: CommunicationsActor) {
    return this.repository.listChannelAccounts(actor);
  }

  async listThreads(actor: CommunicationsActor, input: {
    status?: CommunicationThreadStatus;
    limit?: number;
    offset?: number;
  }) {
    return this.repository.listThreads({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async listMessages(actor: CommunicationsActor, input: {
    threadId: string;
    limit?: number;
    offset?: number;
  }) {
    return this.repository.listMessages({
      tenantId: actor.tenantId,
      threadId: input.threadId,
      limit: input.limit,
      offset: input.offset,
    });
  }

  async createTemplate(actor: CommunicationsActor, input: Parameters<CommunicationsRepository["createTemplate"]>[1]) {
    return this.repository.createTemplate(actor, input);
  }

  async listTemplates(actor: CommunicationsActor) {
    return this.repository.listTemplates(actor);
  }

  async updateThread(actor: CommunicationsActor, threadId: string, input: {
    status?: CommunicationThreadStatus;
    assignedToUserId?: string;
    intent?: string;
  }): Promise<CommunicationThreadRecord> {
    return this.repository.updateThread({ tenantId: actor.tenantId, threadId, ...input });
  }

  async receiveInbound(actor: CommunicationsActor, input: InboundCommunicationMessage) {
    const normalizedPhone = normalizePhone(input.contactPhone);
    const message: InboundCommunicationMessage = {
      ...input,
      contactPhone: normalizedPhone,
      externalThreadId: input.externalThreadId ?? normalizedPhone,
    };

    const existingUser = await this.repository.findUserByPhone({
      tenantId: actor.tenantId,
      phone: normalizedPhone,
    });

    let lead: { id: string } | null = await this.repository.findContractorLeadByPhone({
      tenantId: actor.tenantId,
      phone: normalizedPhone,
    });

    if (!lead && isProjectLikeMessage(message.body)) {
      lead = await this.contractorService.createLead({
        tenantId: actor.tenantId,
        orgId: actor.orgId,
        createdBy: actor.userId,
        name: message.contactName ?? `WhatsApp ${normalizedPhone}`,
        phone: normalizedPhone,
        jobType: inferJobType(message.body),
        description: message.body,
        notes: "Lead creado automaticamente desde SEMSE Communications.",
        nextAction: "Responder intake y calificar alcance",
        source: "whatsapp",
      });
    }

    const thread = await this.repository.upsertThreadFromInbound(actor, {
      ...message,
      contractorLeadId: message.contractorLeadId ?? lead?.id,
    });

    const storedMessage = await this.repository.appendInboundMessage({
      actor,
      threadId: thread.id,
      message,
    });

    await this.repository.upsertContactIdentity({
      actor,
      channel: message.channel,
      phone: normalizedPhone,
      displayName: message.contactName,
      externalContactId: message.externalThreadId,
      userId: existingUser?.id,
      contractorLeadId: lead?.id,
      metadataJson: {
        lastInboundMessageId: storedMessage.id,
        source: "whatsapp",
      },
    });

    let smartIntake: unknown = null;
    if (isProjectLikeMessage(message.body)) {
      try {
        const existingIntakeId = getNestedString(thread.metadataJson, ["smartIntake", "intakeId"]);
        smartIntake = await this.smartIntakeService.analyze({
          tenantId: actor.tenantId,
          sessionToken: `communications:${thread.id}`,
          intakeId: existingIntakeId,
          rawDescription: message.body ?? "",
        });
        const intakeId = getNestedString(
          smartIntake as Record<string, unknown>,
          ["intake", "id"],
        );
        await this.repository.linkThread({
          tenantId: actor.tenantId,
          threadId: thread.id,
          contractorLeadId: lead?.id,
          metadataJson: {
            ...(thread.metadataJson ?? {}),
            smartIntake: {
              intakeId,
              status: getNestedString(smartIntake as Record<string, unknown>, ["intake", "status"]),
              estimateUnlocked: Boolean((smartIntake as { estimateUnlocked?: unknown }).estimateUnlocked),
            },
          },
        });
      } catch (error) {
        this.logger.warn({ threadId: thread.id, error }, "Smart intake bridge skipped for inbound message");
      }
    } else if (lead?.id && !thread.contractorLeadId) {
      await this.repository.linkThread({
        tenantId: actor.tenantId,
        threadId: thread.id,
        contractorLeadId: lead.id,
      });
    }

    return {
      thread: await this.repository.getThread({ tenantId: actor.tenantId, threadId: thread.id }),
      message: storedMessage,
      lead,
      smartIntake,
    };
  }

  async sendMessage(actor: CommunicationsActor, input: SendCommunicationMessage, options?: { notificationId?: string }) {
    const recipientPhone = input.recipientPhone ? normalizePhone(input.recipientPhone) : undefined;
    const message: SendCommunicationMessage = { ...input, recipientPhone };
    let thread = await this.repository.findThreadForOutbound({
      tenantId: actor.tenantId,
      threadId: message.threadId,
      channel: message.channel,
      recipientPhone,
      jobId: message.jobId,
      projectId: message.projectId,
      contractorLeadId: message.contractorLeadId,
    });

    if (!thread) {
      thread = await this.repository.createOutboundThread(actor, message);
    }

    const delivery = await this.repository.createOutboundDelivery({
      actor,
      threadId: thread.id,
      notificationId: options?.notificationId,
      message,
    });

    try {
      const to = recipientPhone ?? thread.contactPhone ?? "";
      if (!to) {
        throw new BadRequestException("recipientPhone is required for outbound communication");
      }

      const result = message.channel === CommunicationProvider.WHATSAPP_CLOUD
        ? await this.whatsapp.sendText({ to, body: message.body })
        : {
            providerMessageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            raw: { mode: "mock", channel: message.channel },
          };

      await this.repository.markOutboundDelivery({
        deliveryId: delivery.id,
        providerMessageId: result.providerMessageId,
        status: CommunicationMessageStatus.SENT,
      });

      const storedMessage = await this.repository.appendOutboundMessage({
        actor,
        threadId: thread.id,
        message,
        externalMessageId: result.providerMessageId,
        status: CommunicationMessageStatus.SENT,
      });

      return {
        delivery: {
          ...delivery,
          status: CommunicationMessageStatus.SENT,
          providerMessageId: result.providerMessageId,
        },
        thread,
        message: storedMessage,
        provider: result.raw,
      };
    } catch (error) {
      await this.repository.markOutboundDelivery({
        deliveryId: delivery.id,
        status: CommunicationMessageStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async handleWhatsAppWebhook(body: unknown) {
    const actor = this.actorFromWebhookEnv();
    const parsed = this.whatsapp.parseWebhook(body);
    const messages = [];

    for (const inbound of parsed.messages) {
      messages.push(await this.receiveInbound(actor, {
        channel: CommunicationProvider.WHATSAPP_CLOUD,
        externalThreadId: inbound.contactPhone,
        externalMessageId: inbound.externalMessageId,
        contactPhone: inbound.contactPhone,
        contactName: inbound.contactName,
        body: inbound.body,
        media: inbound.media,
        rawPayload: inbound.rawPayload,
      }));
    }

    for (const status of parsed.statuses) {
      await this.repository.updateDeliveryStatusByProviderMessageId({
        providerMessageId: status.providerMessageId,
        status: mapProviderStatus(status.status),
      });
    }

    return {
      receivedMessages: messages.length,
      statusUpdates: parsed.statuses.length,
      messages,
    };
  }
}
