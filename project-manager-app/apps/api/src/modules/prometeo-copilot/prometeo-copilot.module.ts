import { Module } from "@nestjs/common";
import { OrchestrationModule } from "../orchestration/orchestration.module.js";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { PrometeoCopilotController } from "./prometeo-copilot.controller.js";
import { PrometeoCopilotService } from "./prometeo-copilot.service.js";

@Module({
  imports: [OrchestrationModule, WorkspaceModule],
  controllers: [PrometeoCopilotController],
  providers: [PrometeoCopilotService],
  exports: [PrometeoCopilotService],
})
export class PrometeoCopilotModule {}
