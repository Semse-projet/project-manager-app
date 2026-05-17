import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { OperationalSignalsService } from "./operational-signals.service.js";
import { IntelligenceRunsService } from "./intelligence-runs.service.js";
import { BuildOpsIntelligenceAgent } from "./buildops-intelligence.agent.js";
import { PrometeoBriefService } from "./prometeo-brief.service.js";
import { LLMNarrativeService } from "./llm-narrative.service.js";
import { OperationalIntelligenceController } from "./operational-intelligence.controller.js";

@Module({
  imports: [PrismaModule, LLMModule],
  controllers: [OperationalIntelligenceController],
  providers: [
    OperationalSignalsService,
    IntelligenceRunsService,
    BuildOpsIntelligenceAgent,
    PrometeoBriefService,
    LLMNarrativeService,
  ],
  exports: [
    OperationalSignalsService,
    IntelligenceRunsService,
    BuildOpsIntelligenceAgent,
    PrometeoBriefService,
    LLMNarrativeService,
  ],
})
export class OperationalIntelligenceModule {}
