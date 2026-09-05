import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type PushDeviceTokenRecord = {
  id: string;
  tenantId: string;
  userId: string;
  deviceId: string;
  expoPushToken: string;
  platform: string;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
};

@Injectable()
export class PushNotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertToken(data: {
    tenantId: string;
    userId: string;
    deviceId: string;
    expoPushToken: string;
    platform: string;
  }): Promise<PushDeviceTokenRecord> {
    return this.prisma.pushDeviceToken.upsert({
      where: { userId_deviceId: { userId: data.userId, deviceId: data.deviceId } },
      create: {
        tenantId: data.tenantId,
        userId: data.userId,
        deviceId: data.deviceId,
        expoPushToken: data.expoPushToken,
        platform: data.platform,
      },
      update: {
        expoPushToken: data.expoPushToken,
        platform: data.platform,
        revokedAt: null,
      },
    }) as unknown as PushDeviceTokenRecord;
  }

  async revokeToken(userId: string, deviceId: string): Promise<void> {
    await this.prisma.pushDeviceToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Every non-revoked token for a user, across all of their devices. */
  async findActiveTokensByUser(tenantId: string, userId: string): Promise<PushDeviceTokenRecord[]> {
    return this.prisma.pushDeviceToken.findMany({
      where: { tenantId, userId, revokedAt: null },
    }) as unknown as PushDeviceTokenRecord[];
  }
}
