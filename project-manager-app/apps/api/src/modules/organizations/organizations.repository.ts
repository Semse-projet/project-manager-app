import { Injectable, NotFoundException } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

type StoredOrg = {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

type StoredMembership = {
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
  }): Promise<OrgRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const orgs = (await this.prisma.org.findMany({
      where: { tenantId: input.tenantId },
      orderBy: { createdAt: "desc" }
    })) as StoredOrg[];

    return orgs.map((org) => this.toOrgRecord(org));
  }

  async findOrgById(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetOrgId: string;
  }): Promise<OrgRecord> {
    await this.actorContextService.ensureActorContext(input);
    const org = (await this.prisma.org.findFirst({
      where: {
        id: input.targetOrgId,
        tenantId: input.tenantId
      }
    })) as StoredOrg | null;

    if (!org) {
      throw new NotFoundException(`Organization '${input.targetOrgId}' not found`);
    }

    return this.toOrgRecord(org);
  }

  async findMembershipsByOrg(input: {
    tenantId: string;
    orgId: string;
    userId: string;
    targetOrgId: string;
  }): Promise<MembershipRecord[]> {
    await this.actorContextService.ensureActorContext(input);
    const memberships = (await this.prisma.membership.findMany({
      where: {
        orgId: input.targetOrgId,
        org: { tenantId: input.tenantId }
      },
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
      orderBy: { createdAt: "desc" }
    })) as StoredMembership[];

    return memberships.map((m) => this.toMembershipRecord(m));
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
      userId: m.userId,
      orgId: m.orgId,
      roleId: m.roleId,
      createdAt: m.createdAt
    };
  }
}
