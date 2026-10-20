import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { isOpsAdmin } from "../../common/resource-scope.js";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type StoredOrg = {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  users?: Array<{ role: { key: string } }>;
};

type StoredMembership = {
  status?: string;
  role?: { key: string };
  userId: string;
  orgId: string;
  roleId: string;
  createdAt: Date;
};

export type OrgRecord = {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipRecord = {
  status?: string;
  roleKey?: string;
  userId: string;
  orgId: string;
  roleId: string;
  createdAt: Date;
};

@Injectable()
export class OrganizationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actorContextService: ActorContextService
  ) {}

  async findOrgsByTenant(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  }): Promise<OrgRecord[]> {
    const orgs = (await this.prisma.org.findMany({
      where: {
        tenantId: input.tenantId,
        ...(isOpsAdmin(input) ? {} : { users: { some: { userId: input.userId, status: "ACTIVE" } } })
      },
      include: this.actorMemberships(input.userId),
      orderBy: { createdAt: "desc" }
    })) as StoredOrg[];

    return orgs
      .filter((org) => isOpsAdmin(input) || this.hasOrgPermission(org, "org:read"))
      .map((org) => this.toOrgRecord(org));
  }

  async findOrgById(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetOrgId: string;
    roles: string[];
  }): Promise<OrgRecord> {
    return this.findOrgWithPermission(input, "org:read");
  }

  private async findOrgWithPermission(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetOrgId: string;
    roles: string[];
  }, permission: "org:read" | "org:members:read"): Promise<OrgRecord> {
    const org = (await this.prisma.org.findFirst({
      where: {
        id: input.targetOrgId,
        tenantId: input.tenantId,
        ...(isOpsAdmin(input) ? {} : { users: { some: { userId: input.userId, status: "ACTIVE" } } })
      },
      include: this.actorMemberships(input.userId)
    })) as StoredOrg | null;

    if (!org) {
      throw new NotFoundException(`Organization '${input.targetOrgId}' not found`);
    }

    // A permission in the session's Org A must not be borrowed for Org B.
    // The query limits this projection to the actor's ACTIVE target memberships.
    if (!isOpsAdmin(input) && !this.hasOrgPermission(org, permission)) {
      throw new ForbiddenException("Insufficient organization permissions");
    }

    return this.toOrgRecord(org);
  }

  async findMembershipsByOrg(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetOrgId: string;
    roles: string[];
  }): Promise<MembershipRecord[]> {
    // Verify visibility first; never enumerate members across org boundaries.
    await this.findOrgWithPermission(input, "org:members:read");
    const memberships = (await this.prisma.membership.findMany({
      where: {
        orgId: input.targetOrgId,
        org: { tenantId: input.tenantId },
        status: "ACTIVE"
      },
      include: { role: { select: { key: true } } },
      orderBy: { createdAt: "desc" }
    })) as StoredMembership[];

    return memberships.map((m) => this.toMembershipRecord(m));
  }

  async findMembershipsByUser(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetUserId: string;
  }): Promise<MembershipRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const memberships = (await this.prisma.membership.findMany({
      where: {
        userId: input.targetUserId,
        org: { tenantId: input.tenantId }
      },
      include: { role: { select: { key: true } } },
      orderBy: { createdAt: "desc" }
    })) as StoredMembership[];

    return memberships.map((m) => this.toMembershipRecord(m));
  }

  private actorMemberships(userId: string) {
    return {
      users: {
        where: { userId, status: "ACTIVE" },
        select: { role: { select: { key: true } } }
      }
    } as const;
  }

  private hasOrgPermission(org: StoredOrg, permission: string): boolean {
    return hasPermission((org.users ?? []).map((membership) => membership.role.key), permission);
  }

  private toOrgRecord(org: StoredOrg): OrgRecord {
    return {
      id: org.id,
      tenantId: org.tenantId,
      type: org.type,
      name: org.name,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    };
  }

  private toMembershipRecord(m: StoredMembership): MembershipRecord {
    return {
      ...(m.status ? { status: m.status } : {}),
      ...(m.role ? { roleKey: m.role.key } : {}),
      userId: m.userId,
      orgId: m.orgId,
      roleId: m.roleId,
      createdAt: m.createdAt
    };
  }
}


