import { Injectable, Logger } from "@nestjs/common";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import { PushNotificationsRepository } from "./push-notifications.repository.js";

/**
 * Sends Expo push notifications for the same events
 * apps/api/src/modules/notifications/notifications.service.ts already turns
 * into in-app notifications — see handleEvent() there, which calls
 * sendToUser() alongside creating the in-app record. Kept as its own
 * service (rather than folded into NotificationsService) so a push-specific
 * failure can never affect in-app notification delivery.
 */
@Injectable()
export class PushDispatchService {
  private readonly logger = new Logger(PushDispatchService.name);
  private readonly expo = new Expo();

  constructor(private readonly repository: PushNotificationsRepository) {}

  async sendToUser(
    tenantId: string,
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const tokens = await this.repository.findActiveTokensByUser(tenantId, userId);
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = [];
    for (const token of tokens) {
      if (!Expo.isExpoPushToken(token.expoPushToken)) {
        this.logger.warn(`Skipping malformed Expo push token for user ${userId} device ${token.deviceId}`);
        continue;
      }
      messages.push({ to: token.expoPushToken, title, body, data, sound: "default" });
    }
    if (messages.length === 0) return;

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      // messages (and therefore chunk) preserve the order of the `tokens`
      // array minus any skipped malformed entries — track the corresponding
      // deviceId per chunked message so a DeviceNotRegistered ticket can be
      // mapped back to the right row to revoke.
      const chunkDeviceIds = chunk.map((m) => tokens.find((t) => t.expoPushToken === m.to)?.deviceId).filter((id): id is string => !!id);
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        await this.revokeDeviceNotRegistered(userId, tickets, chunkDeviceIds);
      } catch (error) {
        this.logger.warn(`Expo push chunk failed for user ${userId}: ${String(error)}`);
      }
    }
  }

  /** A DeviceNotRegistered ticket means the token is dead (app uninstalled, etc.) — revoke it so future sends skip it. */
  private async revokeDeviceNotRegistered(
    userId: string,
    tickets: ExpoPushTicket[],
    deviceIds: string[],
  ): Promise<void> {
    await Promise.all(
      tickets.map(async (ticket, index) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          const deviceId = deviceIds[index];
          if (deviceId) await this.repository.revokeToken(userId, deviceId).catch(() => undefined);
        }
      }),
    );
  }
}
