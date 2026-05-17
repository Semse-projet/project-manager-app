import { Module } from "@nestjs/common";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { ChunkerService } from "./chunker.service.js";
import { EmbeddingService } from "./embedding.service.js";
import { PrometeoController } from "./prometeo.controller.js";
import { PrometeoRepository } from "./prometeo.repository.js";
import { PrometeoService } from "./prometeo.service.js";

@Module({
  imports: [LLMModule],
  controllers: [PrometeoController],
  providers: [ChunkerService, EmbeddingService, PrometeoRepository, PrometeoService],
  exports: [PrometeoService, EmbeddingService, ChunkerService],
})
export class PrometeoModule {}
