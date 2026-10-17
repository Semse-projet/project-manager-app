import { Module } from "@nestjs/common";
import { InvitationsController, OrgInvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";
import { MyOffersController, OrgOffersController } from "./offers.controller.js";
import { OffersService } from "./offers.service.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsRepository } from "./organizations.repository.js";
import { OrganizationsService } from "./organizations.service.js";

@Module({
  controllers: [OrganizationsController, OrgInvitationsController, InvitationsController, OrgOffersController, MyOffersController],
  providers: [OrganizationsRepository, OrganizationsService, InvitationsService, OffersService],
  exports: [OrganizationsRepository, OrganizationsService]
})
export class OrganizationsModule {}
