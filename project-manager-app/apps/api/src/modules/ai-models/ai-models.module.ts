import { forwardRef, Module } from "@nestjs/common";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { PrometeoModule } from "../prometeo/prometeo.module.js";
import { AiModelGatewayService } from "./gateway/ai-model-gateway.service.js";
import { AiInteractionLoggerService } from "./logging/ai-interaction-logger.service.js";
import { AiMissionIncidentService } from "./logging/ai-mission-incident.service.js";
import { OPERATIONAL_CONTEXT_SERVICE } from "./context/operational-context.token.js";
import { AiModelRouterService } from "./router/ai-model-router.service.js";
import { AiModelsController } from "./ai-models.controller.js";
import { OperationalContextService } from "./context/operational-context.service.js";
import { PrometeoOrchestratorService } from "./orchestrator/prometeo-orchestrator.service.js";
import { SkillsModule } from "../skills/skills.module.js";

@Module({
  imports: [LLMModule, PrismaModule, forwardRef(() => FinanceModule), forwardRef(() => IntelligenceModule), SkillsModule, PrometeoModule],
  controllers: [AiModelsController],
  providers: [
    AiModelRouterService,
    AiModelGatewayService,
    AiInteractionLoggerService,
    AiMissionIncidentService,
    OperationalContextService,
    { provide: OPERATIONAL_CONTEXT_SERVICE, useExisting: OperationalContextService },
    PrometeoOrchestratorService,
  ],
  exports: [
    AiModelGatewayService,
    AiModelRouterService,
    AiInteractionLoggerService,
    AiMissionIncidentService,
    OperationalContextService,
    OPERATIONAL_CONTEXT_SERVICE,
    PrometeoOrchestratorService,
  ],
})
export class AiModelsModule {}
