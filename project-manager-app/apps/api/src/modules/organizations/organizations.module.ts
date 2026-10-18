import { Module } from "@nestjs/common";
import { CrewsService } from "./crews.service.js";
import { MyCrewsController, OrgCrewsController } from "./crews.controller.js";
import { InvitationsController, OrgInvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";
import { MyOffersController, OrgOffersController } from "./offers.controller.js";
import { OffersService } from "./offers.service.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsRepository } from "./organizations.repository.js";
import { OrganizationsService } from "./organizations.service.js";

@Module({
  controllers: [OrganizationsController, OrgInvitationsController, InvitationsController, OrgOffersController, MyOffersController, OrgCrewsController, MyCrewsController],
  providers: [OrganizationsRepository, OrganizationsService, InvitationsService, OffersService, CrewsService],
  exports: [OrganizationsRepository, OrganizationsService]
})
export class OrganizationsModule {}
