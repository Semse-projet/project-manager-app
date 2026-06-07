import { Injectable } from "@nestjs/common";
import { ActorContextService } from "../../infrastructure/persistence/actor-context.service.js";
import { type MembershipRecord, type OrgRecord, OrganizationsRepository } from "./organizations.repository.js";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly actorContextService: ActorContextService
  ) {}

  async listOrgs(actor: {
    tenantId: string;
    orgId: string;
    userId: string;
  }): Promise<OrgRecord[]> {
    await this.actorContextService.ensureActorContext(actor);
    return this.organizationsRepository.findOrgsByTenant(actor);
  }

  async getOrg(actor: {
    tenantId: string;
    orgId: string;
    userId: string;
  }, orgId: string): Promise<OrgRecord> {
    await this.actorContextService.ensureActorContext(actor);
    return this.organizationsRepository.findOrgById({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetOrgId: orgId
    });
  }

  async listMembers(actor: {
    tenantId: string;
    orgId: string;
    userId: string;
  }, orgId: string): Promise<MembershipRecord[]> {
    await this.actorContextService.ensureActorContext(actor);
    return this.organizationsRepository.findMembershipsByOrg({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      targetOrgId: orgId
    });
  }
}
