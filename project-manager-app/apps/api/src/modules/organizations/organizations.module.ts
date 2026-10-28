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

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrgInvitationsController, InvitationsController, OrgOffersController, MyOffersController, OrgCrewsController, MyCrewsController, CrewTaskAllocationsController, CrewTasksController, MyTaskAllocationsController],
  providers: [OrganizationsRepository, OrganizationsService, InvitationsService, OffersService, CrewsService, TaskAllocationsService, EmailService],
  exports: [OrganizationsRepository, OrganizationsService]
})
export class OrganizationsModule {}
