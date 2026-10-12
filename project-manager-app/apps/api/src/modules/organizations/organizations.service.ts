import { Injectable } from "@nestjs/common";
import { type MembershipRecord, type OrgRecord, OrganizationsRepository } from "./organizations.repository.js";

@Injectable()
export class OrganizationsService {
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}

  async listOrgs(actor: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  }): Promise<OrgRecord[]> {
    return this.organizationsRepository.findOrgsByTenant(actor);
  }

  async getOrg(actor: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  }, orgId: string): Promise<OrgRecord> {
    return this.organizationsRepository.findOrgById({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      targetOrgId: orgId
    });
  }

  async listMembers(actor: {
    tenantId: string;
    orgId: string;
    userId: string;
    roles: string[];
  }, orgId: string): Promise<MembershipRecord[]> {
    return this.organizationsRepository.findMembershipsByOrg({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      targetOrgId: orgId
    });
  }
}
