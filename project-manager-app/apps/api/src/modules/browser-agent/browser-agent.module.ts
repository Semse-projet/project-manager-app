import { Module } from "@nestjs/common";
import { BrowserAgentController } from "./browser-agent.controller.js";
import { BrowserAgentService } from "./browser-agent.service.js";
import { AgentsModule } from "../agents/agents.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { EvidenceGatewayModule } from "../evidence-gateway/evidence-gateway.module.js";

@Module({
  imports: [
    AgentsModule,
    AiModelsModule,
    EvidenceGatewayModule,
  ],
  controllers: [BrowserAgentController],
  providers: [BrowserAgentService],
  exports: [BrowserAgentService],
})
export class BrowserAgentModule {}
