import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type NotificationRecord = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  channel: string;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type NotificationRow = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  channel: string;
  readAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
};

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: (row.payload as Record<string, unknown>) ?? null,
    channel: row.channel,
    readAt: row.readAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    channel?: NotificationChannel;
  }): Promise<NotificationRecord> {
    const row = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: (input.payload ?? {}) as unknown as import("@prisma/client").Prisma.InputJsonValue,
        channel: input.channel ?? NotificationChannel.IN_APP,
        sentAt: new Date(),
      },
    });
    return toRecord(row as NotificationRow);
  }

  async listForUser(input: {
    tenantId: string;
    userId: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<NotificationRecord[]> {
    const rows = await this.prisma.notification.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        ...(input.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
    });
    return (rows as NotificationRow[]).map(toRecord);
  }

  async countUnread(input: { tenantId: string; userId: string }): Promise<number> {
    return this.prisma.notification.count({
      where: { tenantId: input.tenantId, userId: input.userId, readAt: null },
    });
  }

  async markRead(input: {
    tenantId: string;
    userId: string;
    notificationId: string;
  }): Promise<NotificationRecord> {
    const row = await this.prisma.notification.updateMany({
      where: {
        id: input.notificationId,
        tenantId: input.tenantId,
        userId: input.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    if (row.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: { id: input.notificationId, tenantId: input.tenantId, userId: input.userId },
      });
      if (!existing) throw new Error(`Notification ${input.notificationId} not found`);
      return toRecord(existing as NotificationRow);
    }

    const updated = await this.prisma.notification.findFirstOrThrow({
      where: { id: input.notificationId },
    });
    return toRecord(updated as NotificationRow);
  }

  async markAllRead(input: { tenantId: string; userId: string }): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId: input.tenantId, userId: input.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async upsertPushSubscription(input: {
    tenantId: string;
    userId: string;
    endpoint: string;
    keys: Record<string, string>;
  }): Promise<void> {
    // Store in a JSON field on the user record (no schema migration needed).
    // We use the user's profile settings JSON as a lightweight store.
    // A proper push_subscriptions table would be better long-term.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "UserProfile"
       SET "settingsJson" = COALESCE("settingsJson", '{}'::jsonb)
         || jsonb_build_object(
              'pushSubscription',
              jsonb_build_object(
                'endpoint', $1::text,
                'keys', $2::jsonb,
                'savedAt', now()::text
              )
            )
       WHERE "userId" = $3::text`,
      input.endpoint,
      JSON.stringify(input.keys),
      input.userId,
    );
  }
}
