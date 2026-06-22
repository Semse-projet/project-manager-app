import { Module, forwardRef } from "@nestjs/common";
import { AgentQueueModule } from "../../infrastructure/queue/agent-queue.module.js";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { SseInfraModule } from "../../infrastructure/sse/sse-infra.module.js";
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
import { BehavioralObserverService } from "./behavioral-observer.service.js";
import { RecommendationEngineService } from "./recommendation-engine.service.js";
import { SimulationEngineService } from "./simulation-engine.service.js";
import { ApplyEngineService } from "./apply-engine.service.js";
import { EvolutionEngineService } from "./evolution-engine.service.js";
import { EvolutionFeedbackService } from "./evolution-feedback.service.js";
import { EcosystemMetricsService } from "./ecosystem-metrics.service.js";
import { SemseAgentsModule } from "../semse-agents/semse-agents.module.js";

const providers = [
  OpsRepository, OpsService, TrustRepository, TrustService,
  ConsciousnessIndexService, SystemObserverService, BehavioralObserverService,
  RecommendationEngineService, SimulationEngineService, ApplyEngineService,
  EvolutionEngineService, EvolutionFeedbackService, EcosystemMetricsService,
];

@Module({
  imports: [
    AgentQueueModule, LLMModule, PrismaModule, SseInfraModule, AgentsModule, KnowledgeModule, ToolsModule,
    forwardRef(() => SemseAgentsModule),
    forwardRef(() => PrometeoModule),
    forwardRef(() => OperationalIntelligenceModule),
  ],
  controllers: [OpsController],
  providers,
  exports: [
    OpsService, ConsciousnessIndexService, SystemObserverService, BehavioralObserverService,
    RecommendationEngineService, SimulationEngineService, ApplyEngineService,
    EvolutionEngineService, EvolutionFeedbackService, EcosystemMetricsService,
  ],
})
export class OpsModule {}
