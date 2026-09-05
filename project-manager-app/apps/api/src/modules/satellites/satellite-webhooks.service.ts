import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { resolveSafeUrl } from "@semse/shared";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
  isSecretStrengthValid,
} from "./satellite-webhook-crypto.js";
import type { SatelliteIdentity, SatelliteScope } from "./satellites.service.js";

/**
 * docs/specs/satellites/SAT-007-outbound-webhooks.spec.md §3/§8. A satellite
 * registers with the bare event name (matches EVENT_CATALOG.md); the
 * consumer translates to/from the outbox's `.v1` eventType at delivery time.
 */
export const SATELLITE_WEBHOOK_EVENT_SCOPES: Record<string, SatelliteScope> = {
  "job.matched": "jobs:read",
  "job.completed": "jobs:read",
  "rating.requested": "jobs:read",
  "milestone.approved": "milestones:read",
  "milestone.rejected": "milestones:read",
};

export const SATELLITE_WEBHOOK_EVENT_CATALOG = Object.keys(
  SATELLITE_WEBHOOK_EVENT_SCOPES,
) as string[];

/** Sentinel identity for AuditLog rows triggered by a satellite token
 * rather than a human/tenant actor — SatelliteToken/SatelliteWebhook are
 * deliberately tenant-agnostic (spec §3), but AuditLog.tenantId is a
 * required FK. ActorContextService (invoked by AuditService.append)
 * auto-provisions this tenant/org/user via upsert the same way
 * bids.repository.ts already auto-provisions a placeholder Org for a
 * proOrgId string — same established pattern, not a new one. */
const SATELLITE_AUDIT_TENANT_ID = "tenant_default";
const SATELLITE_AUDIT_ORG_ID = "org_satellites";

export function satelliteWebhooksEnabled(): boolean {
  return process.env.SATELLITE_WEBHOOKS_ENABLED === "true";
}

export type SatelliteWebhookView = {
  id: string;
  url: string;
  events: string[];
  status: string;
  lastDeliveryAt: string | null;
  consecutiveFailures: number;
  createdAt: string;
};

type StoredSatelliteWebhook = {
  id: string;
  satelliteTokenId: string;
  url: string;
  events: string[];
  status: string;
  consecutiveFailures: number;
  lastDeliveryAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class SatelliteWebhooksService {
  private readonly logger = new Logger(SatelliteWebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private assertEnabled(): void {
    if (!satelliteWebhooksEnabled()) {
      throw new ServiceUnavailableException({
        message: "Satellite webhooks are disabled — SATELLITE_WEBHOOKS_ENABLED is off",
      });
    }
  }

  async register(input: {
    satellite: SatelliteIdentity;
    url: string;
    events: string[];
    secret?: string;
  }): Promise<SatelliteWebhookView & { secret: string }> {
    this.assertEnabled();

    if (!input.satellite.scopes.includes("events:subscribe")) {
      throw new ForbiddenException({
        message: "Satellite token lacks required scope",
        required: ["events:subscribe"],
      });
    }

    if (input.events.length === 0) {
      throw new BadRequestException({
        message: "events must be a non-empty subset of the satellite webhook catalog",
        catalog: SATELLITE_WEBHOOK_EVENT_CATALOG,
      });
    }

    const unknownEvents = input.events.filter(
      (event) => !SATELLITE_WEBHOOK_EVENT_CATALOG.includes(event),
    );
    if (unknownEvents.length > 0) {
      throw new BadRequestException({
        message: "Unknown satellite webhook event(s)",
        unknownEvents,
        catalog: SATELLITE_WEBHOOK_EVENT_CATALOG,
      });
    }

    const requiredScopes = [
      ...new Set(input.events.map((event) => SATELLITE_WEBHOOK_EVENT_SCOPES[event]!)),
    ];
    const missingScopes = requiredScopes.filter(
      (scope) => !input.satellite.scopes.includes(scope),
    );
    if (missingScopes.length > 0) {
      throw new ForbiddenException({
        message: "Satellite token lacks scopes required for one or more subscribed events",
        missing: missingScopes,
      });
    }

    const safeUrl = await resolveSafeUrl(input.url);
    if (!safeUrl.safe) {
      throw new BadRequestException({
        message: "url failed SSRF validation",
        reason: safeUrl.reason,
      });
    }

    const existing = await this.prisma.satelliteWebhook.findUnique({
      where: {
        satelliteTokenId_url: { satelliteTokenId: input.satellite.id, url: input.url },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        message: "This satellite already has a webhook registered for this URL",
      });
    }

    const secret = input.secret ?? generateWebhookSecret();
    if (!isSecretStrengthValid(secret)) {
      throw new BadRequestException({ message: "secret must be at least 32 characters" });
    }
    const encrypted = encryptWebhookSecret(secret);

    const created = await this.prisma.satelliteWebhook.create({
      data: {
        satelliteTokenId: input.satellite.id,
        url: input.url,
        events: input.events,
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretTag: encrypted.tag,
      },
    });

    await this.auditService.append({
      tenantId: SATELLITE_AUDIT_TENANT_ID,
      orgId: SATELLITE_AUDIT_ORG_ID,
      actorUserId: input.satellite.name,
      action: "SatelliteWebhook.created",
      entityType: "SatelliteWebhook",
      entityId: created.id,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      afterJson: { url: created.url, events: created.events, satellite: input.satellite.name },
    });

    this.logger.log(
      `Satellite webhook registered: satellite=${input.satellite.name} id=${created.id} events=[${created.events.join(",")}]`,
    );

    return { ...this.toView(created), secret };
  }

  async listForSatellite(satellite: SatelliteIdentity): Promise<SatelliteWebhookView[]> {
    const rows = await this.prisma.satelliteWebhook.findMany({
      where: { satelliteTokenId: satellite.id },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => this.toView(row));
  }

  async listAll(): Promise<SatelliteWebhookView[]> {
    const rows = await this.prisma.satelliteWebhook.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row) => this.toView(row));
  }

  async revoke(input: {
    id: string;
    satellite?: SatelliteIdentity;
    isAdmin: boolean;
  }): Promise<{ id: string; status: "REVOKED" }> {
    const webhook = await this.prisma.satelliteWebhook.findUnique({ where: { id: input.id } });
    if (!webhook) {
      throw new NotFoundException({ message: `Satellite webhook '${input.id}' not found` });
    }
    if (!input.isAdmin && webhook.satelliteTokenId !== input.satellite?.id) {
      throw new ForbiddenException({
        message: "Cannot manage a webhook belonging to a different satellite",
      });
    }

    await this.prisma.satelliteWebhook.delete({ where: { id: input.id } });

    await this.auditService.append({
      tenantId: SATELLITE_AUDIT_TENANT_ID,
      orgId: SATELLITE_AUDIT_ORG_ID,
      actorUserId: input.satellite?.name ?? "OPS_ADMIN",
      action: "SatelliteWebhook.revoked",
      entityType: "SatelliteWebhook",
      entityId: webhook.id,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
      afterJson: { url: webhook.url },
    });

    return { id: webhook.id, status: "REVOKED" };
  }

  /** SAT-007 spec §4 P2 edge case: revoking the parent token suspends its
   * webhooks in the same operation, not on the next delivery's failure
   * count — there's no way to sign/authorize a delivery once the token
   * that owns it is gone. */
  async suspendAllForToken(satelliteTokenId: string): Promise<number> {
    const result = await this.prisma.satelliteWebhook.updateMany({
      where: { satelliteTokenId, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    return result.count;
  }

  /** Used only by the delivery consumer — never returns the secret to an
   * HTTP caller. */
  async findActiveForEvent(bareEventType: string): Promise<
    Array<StoredSatelliteWebhook & { secret: string }>
  > {
    const rows = await this.prisma.satelliteWebhook.findMany({
      where: { status: "ACTIVE", events: { has: bareEventType } },
    });
    return rows.map((row) => ({
      ...row,
      secret: decryptWebhookSecret({
        ciphertext: row.secretCiphertext,
        iv: row.secretIv,
        tag: row.secretTag,
      }),
    }));
  }

  async recordDeliverySuccess(webhookId: string): Promise<void> {
    await this.prisma.satelliteWebhook.updateMany({
      where: { id: webhookId },
      data: { consecutiveFailures: 0, lastDeliveryAt: new Date() },
    });
  }

  /** Returns true if this failure pushed the webhook into SUSPENDED. */
  async recordDeliveryFailure(webhookId: string): Promise<boolean> {
    const updated = await this.prisma.satelliteWebhook.update({
      where: { id: webhookId },
      data: { consecutiveFailures: { increment: 1 } },
      select: { consecutiveFailures: true, status: true },
    });
    if (updated.consecutiveFailures >= 5 && updated.status === "ACTIVE") {
      await this.prisma.satelliteWebhook.update({
        where: { id: webhookId },
        data: { status: "SUSPENDED" },
      });
      return true;
    }
    return false;
  }

  private toView(webhook: StoredSatelliteWebhook): SatelliteWebhookView {
    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      status: webhook.status,
      lastDeliveryAt: webhook.lastDeliveryAt?.toISOString() ?? null,
      consecutiveFailures: webhook.consecutiveFailures,
      createdAt: webhook.createdAt.toISOString(),
    };
  }
}
