import { Module, forwardRef } from "@nestjs/common";
import { BrowserAgentController } from "./browser-agent.controller.js";
import { BrowserAgentService } from "./browser-agent.service.js";
import { AgentsModule } from "../agents/agents.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { EvidenceGatewayModule } from "../evidence-gateway/evidence-gateway.module.js";

@Module({
  imports: [
    forwardRef(() => AgentsModule),
    AiModelsModule,
    EvidenceGatewayModule,
    StorageModule,
  ],
  controllers: [BrowserAgentController],
  providers: [BrowserAgentService],
  exports: [BrowserAgentService],
})
export class BrowserAgentModule {}
