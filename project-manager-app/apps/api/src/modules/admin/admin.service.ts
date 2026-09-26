import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import {
  adminSettingsSchema,
  type AdminIntegrationCheck,
  type AdminIntegrationId,
  type AdminSettings,
  type AdminSettingsPatch,
} from '@semse/schemas';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string): Promise<AdminSettings> {
    const row = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    const raw = (row?.settingsJson ?? {}) as Record<string, unknown>;
    return adminSettingsSchema.parse(raw);
  }

  /**
   * Client-facing settings write. `integrations.checks` is server-owned —
   * only `recordIntegrationCheck` may change it — so a stale or forged value
   * in the patch is discarded and the stored verification history is kept.
   */
  async updateSettings(
    tenantId: string,
    patch: AdminSettingsPatch,
    actor: { userId: string; requestId: string }
  ): Promise<AdminSettings> {
    const current = await this.getSettings(tenantId);
    const merged = { ...current, ...patch };
    const next = adminSettingsSchema.parse({
      ...merged,
      integrations: { ...merged.integrations, checks: current.integrations.checks },
    });
    return this.write(tenantId, current, next, actor);
  }

  async recordIntegrationCheck(
    tenantId: string,
    integrationId: AdminIntegrationId,
    check: AdminIntegrationCheck,
    actor: { userId: string; requestId: string }
  ): Promise<AdminSettings> {
    const current = await this.getSettings(tenantId);
    const next = adminSettingsSchema.parse({
      ...current,
      integrations: {
        ...current.integrations,
        checks: { ...current.integrations.checks, [integrationId]: check },
      },
    });
    return this.write(tenantId, current, next, actor);
  }

  private async write(
    tenantId: string,
    current: AdminSettings,
    next: AdminSettings,
    actor: { userId: string; requestId: string }
  ): Promise<AdminSettings> {
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
