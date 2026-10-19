import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { ActorContextService } from "../persistence/actor-context.service.js";

type AuditEntry = {
  id?: string;
  tenantId: string;
  orgId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string;
  timestamp: string;
  beforeJson?: Record<string, unknown>;
  afterJson?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.actorContextService.ensureActorContext({
      tenantId: entry.tenantId,
      orgId: entry.orgId,
      userId: entry.actorUserId
    });

    await this.prisma.auditLog.create({
      data: {
        id: `aud_${crypto.randomUUID()}`,
        tenantId: entry.tenantId,
        actorUserId: entry.actorUserId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        beforeJson: toPrismaJson(entry.beforeJson),
        afterJson: toPrismaJson({
          ...entry.afterJson,
          requestId: entry.requestId,
          timestamp: entry.timestamp
        }),
        occurredAt: new Date(entry.timestamp)
      }
    });
  }
}

function toPrismaJson(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}
