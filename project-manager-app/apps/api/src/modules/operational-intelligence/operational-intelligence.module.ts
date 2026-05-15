import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { OperationalSignalsService } from "./operational-signals.service.js";
import { IntelligenceRunsService } from "./intelligence-runs.service.js";
import { BuildOpsIntelligenceAgent } from "./buildops-intelligence.agent.js";
import { OperationalIntelligenceController } from "./operational-intelligence.controller.js";

@Module({
  imports: [PrismaModule],
  controllers: [OperationalIntelligenceController],
  providers: [OperationalSignalsService, IntelligenceRunsService, BuildOpsIntelligenceAgent],
  exports: [OperationalSignalsService, IntelligenceRunsService, BuildOpsIntelligenceAgent],
})
export class OperationalIntelligenceModule {}
