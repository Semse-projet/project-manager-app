import { Module } from "@nestjs/common";
import { ToolsModule } from "../tools/tools.module.js";
import { SemseAgentsController } from "./semse-agents.controller.js";
import { SemseAgentsService } from "./semse-agents.service.js";
import { ProToolsAgent } from "./protools.agent.js";

@Module({
  imports:     [ToolsModule],
  controllers: [SemseAgentsController],
  providers:   [SemseAgentsService, ProToolsAgent],
  exports:     [SemseAgentsService, ProToolsAgent],
})
export class SemseAgentsModule {}
