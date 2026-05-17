import { Module } from "@nestjs/common";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { ChunkerService } from "./chunker.service.js";
import { DocumentParserService } from "./document-parser.service.js";
import { EmbeddingService } from "./embedding.service.js";
import { PrometeoController } from "./prometeo.controller.js";
import { PrometeoRepository } from "./prometeo.repository.js";
import { PrometeoService } from "./prometeo.service.js";
import { TradeGuideService } from "./trade-guide.service.js";

@Module({
  imports: [LLMModule],
  controllers: [PrometeoController],
  providers: [ChunkerService, DocumentParserService, EmbeddingService, PrometeoRepository, PrometeoService, TradeGuideService],
  exports: [PrometeoService, EmbeddingService, ChunkerService, DocumentParserService, TradeGuideService],
})
export class PrometeoModule {}
