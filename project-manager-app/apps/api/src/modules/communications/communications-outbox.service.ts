import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CommunicationMessageStatus,
  CommunicationProvider,
} from "@prisma/client";
import { CommunicationsRepository } from "./communications.repository.js";
import type { CommunicationsActor, SendCommunicationMessage } from "./communications.types.js";
import { WhatsAppCloudAdapter } from "./providers/whatsapp-cloud.adapter.js";

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, "");
}

@Injectable()
export class CommunicationsOutboxService {
  private readonly logger = new Logger(CommunicationsOutboxService.name);

  constructor(
    private readonly repository: CommunicationsRepository,
    private readonly whatsapp: WhatsAppCloudAdapter,
    private readonly config: ConfigService,
  ) {}

  actorFromEnv(overrides?: Partial<CommunicationsActor>): CommunicationsActor {
    return {
      tenantId: overrides?.tenantId ?? this.config.get<string>("SEMSE_COMMUNICATIONS_TENANT_ID") ?? "tenant_default",
      orgId: overrides?.orgId ?? this.config.get<string>("SEMSE_COMMUNICATIONS_ORG_ID") ?? "org_admin_001",
      userId: overrides?.userId ?? this.config.get<string>("SEMSE_COMMUNICATIONS_ACTOR_USER_ID") ?? "usr_admin_001",
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
        throw new Error("recipientPhone is required for outbound communication");
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

  async deliverNotification(input: {
    tenantId: string;
    notificationId: string;
    userId: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<{ delivered: boolean; reason?: string }> {
    const enabled = this.config.get<string>("SEMSE_COMMUNICATIONS_NOTIFICATION_WHATSAPP") === "true";
    if (!enabled) {
      return { delivered: false, reason: "whatsapp_notifications_disabled" };
    }

    const recipient = await this.repository.findNotificationRecipient({
      tenantId: input.tenantId,
      userId: input.userId,
    });

    if (!recipient?.phone) {
      return { delivered: false, reason: "recipient_phone_missing" };
    }

    const actor = this.actorFromEnv({
      tenantId: input.tenantId,
      orgId: recipient.memberships[0]?.orgId,
    });

    await this.sendMessage(actor, {
      channel: CommunicationProvider.WHATSAPP_CLOUD,
      recipientPhone: recipient.phone,
      body: `${input.title}\n\n${input.body}`,
      payload: {
        notificationId: input.notificationId,
        notificationType: input.payload?.type,
        ...(input.payload ?? {}),
      },
    }, {
      notificationId: input.notificationId,
    });

    this.logger.log({ notificationId: input.notificationId, userId: input.userId }, "WhatsApp notification delivered");
    return { delivered: true };
  }
}
