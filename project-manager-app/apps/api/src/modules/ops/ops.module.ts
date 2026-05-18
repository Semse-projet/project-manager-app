import { Module, forwardRef } from "@nestjs/common";
import { AgentQueueModule } from "../../infrastructure/queue/agent-queue.module.js";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { AgentsModule } from "../agents/agents.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { ToolsModule } from "../tools/tools.module.js";
import { PrometeoModule } from "../prometeo/prometeo.module.js";
import { OpsController } from "./ops.controller.js";
import { OpsRepository } from "./ops.repository.js";
import { OpsService } from "./ops.service.js";
import { TrustRepository } from "../trust/trust.repository.js";
import { TrustService } from "../trust/trust.service.js";

@Module({
  imports: [AgentQueueModule, LLMModule, AgentsModule, KnowledgeModule, ToolsModule, forwardRef(() => PrometeoModule)],
  controllers: [OpsController],
  providers: [OpsRepository, OpsService, TrustRepository, TrustService],
  exports: [OpsService]
})
export class OpsModule {}
