import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { adminSettingsSchema, type AdminSettings, type AdminSettingsPatch } from '@semse/schemas';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string): Promise<AdminSettings> {
    const row = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const raw = (row?.settingsJson ?? {}) as Record<string, unknown>;
    return adminSettingsSchema.parse(raw);
  }

  async updateSettings(
    tenantId: string,
    patch: AdminSettingsPatch,
    actor: { userId: string; requestId: string }
  ): Promise<AdminSettings> {
    const current = await this.getSettings(tenantId);
    const next = adminSettingsSchema.parse({ ...current, ...patch });

    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        settingsJson: next as object,
      },
      update: {
        settingsJson: next as object,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId: actor.userId,
        action: 'tenant.settings.updated',
        entityType: 'TenantSettings',
        entityId: tenantId,
        beforeJson: current as object,
        afterJson: next as object,
      },
    }).catch((err: Error) => {
      this.logger.warn(`Failed to write audit log for settings update: ${err.message}`);
    });

    return next;
  }

  async getSystemSettings(): Promise<any> {
    return {
      maxUploadSize: 100, // MB
      apiRateLimit: 1000, // per hour
      sessionTimeout: 3600, // seconds
    };
  }

  async getAuditLog(): Promise<any[]> {
    return [
      { timestamp: new Date(), action: 'user_login', userId: 'user_1' },
      { timestamp: new Date(), action: 'draw_created', projectId: 'proj_1' },
    ];
  }
}
