import { Module } from "@nestjs/common";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { AgroModule } from "../agro/agro.module.js";
import { FieldOpsModule } from "../field-ops/field-ops.module.js";
import { GraphifyModule } from "../graphify/graphify.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { VisionModule } from "../vision/vision.module.js";
import { ChunkerService } from "./chunker.service.js";
import { DocumentParserService } from "./document-parser.service.js";
import { EmbeddingService } from "./embedding.service.js";
import { ResourceScopeModule } from "../../common/resource-scope.module.js";
import { PrometeoAccessPolicy } from "./prometeo-access.policy.js";
import { PrometeoController } from "./prometeo.controller.js";
import { PrometeoRepository } from "./prometeo.repository.js";
import { PrometeoService } from "./prometeo.service.js";
import { PrometeoToolExecutionService } from "./prometeo-tool-execution.service.js";
import { TradeGuideService } from "./trade-guide.service.js";
import { ToolGovernanceRepository } from "./tool-governance/tool-governance.repository.js";
import { ToolExecutionQueryService } from "./tool-governance/tool-execution-query.service.js";

@Module({
  imports: [ResourceScopeModule, LLMModule, GraphifyModule, FieldOpsModule, AgroModule, VisionModule, PaymentsModule],
  controllers: [PrometeoController],
  providers: [PrometeoAccessPolicy, ChunkerService, DocumentParserService, EmbeddingService, PrometeoRepository, PrometeoService, PrometeoToolExecutionService, TradeGuideService, ToolGovernanceRepository, ToolExecutionQueryService],
  exports: [PrometeoService, EmbeddingService, ChunkerService, DocumentParserService, PrometeoToolExecutionService, TradeGuideService, ToolGovernanceRepository],
})
export class PrometeoModule {}
