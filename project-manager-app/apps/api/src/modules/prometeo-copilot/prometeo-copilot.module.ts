import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { OrchestrationModule } from "../orchestration/orchestration.module.js";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { PrometeoCopilotController } from "./prometeo-copilot.controller.js";
import {
  COPILOT_SESSION_REPOSITORY,
  PrismaCopilotSessionRepository,
} from "./prometeo-copilot.repository.js";
import { PrometeoCopilotService } from "./prometeo-copilot.service.js";

@Module({
  imports: [DomainEventsModule, OrchestrationModule, WorkspaceModule],
  controllers: [PrometeoCopilotController],
  providers: [
    PrometeoCopilotService,
    { provide: COPILOT_SESSION_REPOSITORY, useClass: PrismaCopilotSessionRepository },
  ],
  exports: [PrometeoCopilotService],
})
export class PrometeoCopilotModule {}
