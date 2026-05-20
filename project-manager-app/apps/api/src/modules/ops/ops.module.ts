import { Module, forwardRef } from "@nestjs/common";
import { AgentQueueModule } from "../../infrastructure/queue/agent-queue.module.js";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { AgentsModule } from "../agents/agents.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { ToolsModule } from "../tools/tools.module.js";
import { PrometeoModule } from "../prometeo/prometeo.module.js";
import { OperationalIntelligenceModule } from "../operational-intelligence/operational-intelligence.module.js";
import { OpsController } from "./ops.controller.js";
import { OpsRepository } from "./ops.repository.js";
import { OpsService } from "./ops.service.js";
import { TrustRepository } from "../trust/trust.repository.js";
import { TrustService } from "../trust/trust.service.js";
import { ConsciousnessIndexService } from "./consciousness.service.js";
import { SystemObserverService } from "./observer.service.js";
import { RecommendationEngineService } from "./recommendation-engine.service.js";
import { SimulationEngineService } from "./simulation-engine.service.js";

@Module({
  imports: [
    AgentQueueModule, LLMModule, PrismaModule, AgentsModule, KnowledgeModule, ToolsModule,
    forwardRef(() => PrometeoModule),
    forwardRef(() => OperationalIntelligenceModule),
  ],
  controllers: [OpsController],
  providers: [OpsRepository, OpsService, TrustRepository, TrustService, ConsciousnessIndexService, SystemObserverService, RecommendationEngineService, SimulationEngineService],
  exports: [OpsService, ConsciousnessIndexService, SystemObserverService, RecommendationEngineService, SimulationEngineService],
})
export class OpsModule {}
