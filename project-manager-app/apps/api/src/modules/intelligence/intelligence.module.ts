import { forwardRef, Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { MatchingModule } from "../matching/matching.module.js";
import { DigitalTwinService } from "./digital-twin.service.js";
import { RiskScoringService } from "./risk-scoring.service.js";
import { ProfessionalCredentialService } from "./professional-credential.service.js";
import { PmoService } from "./pmo.service.js";
import { BudgetIntelligenceService } from "./budget-intelligence.service.js";
import { Ecosystem5DService } from "./ecosystem-5d.service.js";
import { PublicInsightsService } from "./public-insights.service.js";
import { IntelligenceController } from "./intelligence.controller.js";

@Module({
  imports: [PrismaModule, LLMModule, MatchingModule, forwardRef(() => AiModelsModule)],
  providers: [DigitalTwinService, RiskScoringService, ProfessionalCredentialService, PmoService, BudgetIntelligenceService, Ecosystem5DService, PublicInsightsService],
  controllers: [IntelligenceController],
  exports: [DigitalTwinService, RiskScoringService, ProfessionalCredentialService, PmoService, BudgetIntelligenceService, Ecosystem5DService, PublicInsightsService],
})
export class IntelligenceModule {}
