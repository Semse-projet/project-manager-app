import { Module } from "@nestjs/common";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { AuthModule } from "../auth/auth.module.js";
import { MyCrewsController, OrgCrewsController } from "./crews.controller.js";
import { CrewsService } from "./crews.service.js";
import { InvitationsController, OrgInvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";
import { MyOffersController, OrgOffersController } from "./offers.controller.js";
import { OffersService } from "./offers.service.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsRepository } from "./organizations.repository.js";
import { OrganizationsService } from "./organizations.service.js";
import { CrewTaskAllocationsController, CrewTasksController, MyTaskAllocationsController } from "./task-allocations.controller.js";
import { TaskAllocationsService } from "./task-allocations.service.js";
import { OrgWorksiteLocationController } from "./worksite-location.controller.js";
import { WorksiteLocationService } from "./worksite-location.service.js";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrgInvitationsController, InvitationsController, OrgOffersController, MyOffersController, OrgCrewsController, MyCrewsController, CrewTaskAllocationsController, CrewTasksController, MyTaskAllocationsController, OrgWorksiteLocationController],
  providers: [OrganizationsRepository, OrganizationsService, InvitationsService, OffersService, CrewsService, TaskAllocationsService, WorksiteLocationService, EmailService],
  exports: [OrganizationsRepository, OrganizationsService]
})
export class OrganizationsModule {}
