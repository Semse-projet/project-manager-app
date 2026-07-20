import { Module } from "@nestjs/common";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { AgroModule } from "../agro/agro.module.js";
import { FieldOpsModule } from "../field-ops/field-ops.module.js";
import { GraphifyModule } from "../graphify/graphify.module.js";
import { VisionModule } from "../vision/vision.module.js";
import { ChunkerService } from "./chunker.service.js";
import { DocumentParserService } from "./document-parser.service.js";
import { EmbeddingService } from "./embedding.service.js";
import { PrometeoController } from "./prometeo.controller.js";
import { PrometeoRepository } from "./prometeo.repository.js";
import { PrometeoService } from "./prometeo.service.js";
import { PrometeoToolExecutionService } from "./prometeo-tool-execution.service.js";
import { TradeGuideService } from "./trade-guide.service.js";
import { ToolGovernanceRepository } from "./tool-governance/tool-governance.repository.js";

@Module({
  imports: [LLMModule, GraphifyModule, FieldOpsModule, AgroModule, VisionModule],
  controllers: [PrometeoController],
  providers: [ChunkerService, DocumentParserService, EmbeddingService, PrometeoRepository, PrometeoService, PrometeoToolExecutionService, TradeGuideService, ToolGovernanceRepository],
  exports: [PrometeoService, EmbeddingService, ChunkerService, DocumentParserService, PrometeoToolExecutionService, TradeGuideService],
})
export class PrometeoModule {}
