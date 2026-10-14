import { Module } from "@nestjs/common";
import { InvitationsController, OrgInvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsRepository } from "./organizations.repository.js";
import { OrganizationsService } from "./organizations.service.js";

@Module({
  controllers: [OrganizationsController, OrgInvitationsController, InvitationsController],
  providers: [OrganizationsRepository, OrganizationsService, InvitationsService],
  exports: [OrganizationsRepository, OrganizationsService]
})
export class OrganizationsModule {}
