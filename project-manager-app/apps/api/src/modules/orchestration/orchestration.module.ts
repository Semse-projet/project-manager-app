import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { OrchestrationController } from "./orchestration.controller.js";
import {
  ORCHESTRATION_REPOSITORY,
  PrismaOrchestrationRepository,
} from "./orchestration.repository.js";
import { OrchestrationService } from "./orchestration.service.js";

@Module({
  imports: [DomainEventsModule],
  controllers: [OrchestrationController],
  providers: [
    OrchestrationService,
    { provide: ORCHESTRATION_REPOSITORY, useClass: PrismaOrchestrationRepository },
  ],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}
