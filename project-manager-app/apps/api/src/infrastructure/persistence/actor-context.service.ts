import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

function inferOrgType(orgId: string): string {
  const normalized = orgId.toLowerCase();
  if (normalized.includes("ops") || normalized.includes("worker")) {
    return "ops";
  }
  if (normalized.includes("pro") || normalized.includes("vendor")) {
    return "pro";
  }
  return "client";
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class ActorContextService {
  private readonly tenantCache = new Set<string>();
  private readonly orgCache = new Set<string>();
  private readonly userCache = new Set<string>();
  private readonly tenantInflight = new Map<string, Promise<void>>();
  private readonly orgInflight = new Map<string, Promise<void>>();
  private readonly userInflight = new Map<string, Promise<void>>();

  constructor(private readonly prisma: PrismaService) {}

  async ensureActorContext(input: { tenantId: string; orgId: string; userId: string }): Promise<void> {
    await this.ensureTenant(input.tenantId);
    await this.ensureOrg(input.tenantId, input.orgId);
    await this.ensureUser(input.userId);
  }

  private async ensureTenant(tenantId: string): Promise<void> {
    await this.ensureOnce(this.tenantCache, this.tenantInflight, tenantId, async () => {
      await this.prisma.tenant.upsert({
        where: { id: tenantId },
        update: {},
        create: {
          id: tenantId,
          slug: tenantId,
          name: tenantId,
          status: "active"
        }
      });
    });
  }

  private async ensureOrg(tenantId: string, orgId: string): Promise<void> {
    await this.ensureOnce(this.orgCache, this.orgInflight, orgId, async () => {
      await this.prisma.org.upsert({
        where: { id: orgId },
        update: {},
        create: {
          id: orgId,
          tenantId,
          type: inferOrgType(orgId),
          name: orgId
        }
      });
    });
  }

  private async ensureUser(userId: string): Promise<void> {
    await this.ensureOnce(this.userCache, this.userInflight, userId, async () => {
      await this.prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: `${userId}@semse.local`,
          status: "active"
        }
      });
    });
  }

  private async ensureOnce(
    cache: Set<string>,
    inflight: Map<string, Promise<void>>,
    key: string,
    operation: () => Promise<void>
  ): Promise<void> {
    if (cache.has(key)) {
      return;
    }

    const pending = inflight.get(key);
    if (pending) {
      await pending;
      return;
    }

    const promise = operation()
      .catch((error: unknown) => {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      })
      .then(() => {
        cache.add(key);
      })
      .finally(() => {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    await promise;
  }
}
