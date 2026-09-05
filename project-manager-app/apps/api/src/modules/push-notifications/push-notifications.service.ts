import { Injectable } from "@nestjs/common";
import type { RegisterPushTokenInput } from "@semse/schemas";
import { PushNotificationsRepository, type PushDeviceTokenRecord } from "./push-notifications.repository.js";

@Injectable()
export class PushNotificationsService {
  constructor(private readonly repository: PushNotificationsRepository) {}

  async registerToken(
    actor: { tenantId: string; userId: string },
    input: RegisterPushTokenInput,
  ): Promise<PushDeviceTokenRecord> {
    return this.repository.upsertToken({
      tenantId: actor.tenantId,
      userId: actor.userId,
      deviceId: input.deviceId,
      expoPushToken: input.expoPushToken,
      platform: input.platform,
    });
  }

  async unregisterToken(actor: { userId: string }, deviceId: string): Promise<void> {
    await this.repository.revokeToken(actor.userId, deviceId);
  }
}
