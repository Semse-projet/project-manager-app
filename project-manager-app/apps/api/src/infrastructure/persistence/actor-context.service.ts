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

@Injectable()
export class ActorContextService {
  private readonly tenantCache = new Set<string>();
  private readonly orgCache = new Set<string>();
  private readonly userCache = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async ensureActorContext(input: { tenantId: string; orgId: string; userId: string }): Promise<void> {
    await this.ensureTenant(input.tenantId);
    await this.ensureOrg(input.tenantId, input.orgId);
    await this.ensureUser(input.userId);
  }

  private async ensureTenant(tenantId: string): Promise<void> {
    if (this.tenantCache.has(tenantId)) {
      return;
    }

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

    this.tenantCache.add(tenantId);
  }

  private async ensureOrg(tenantId: string, orgId: string): Promise<void> {
    if (this.orgCache.has(orgId)) {
      return;
    }

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

    this.orgCache.add(orgId);
  }

  private async ensureUser(userId: string): Promise<void> {
    if (this.userCache.has(userId)) {
      return;
    }

    await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@semse.local`,
        status: "active"
      }
    });

    this.userCache.add(userId);
  }
}
