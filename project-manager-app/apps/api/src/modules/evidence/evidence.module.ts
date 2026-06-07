import { Module, forwardRef } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { EvidenceController } from "./evidence.controller.js";
import { EvidenceRepository } from "./evidence.repository.js";
import { EvidenceService } from "./evidence.service.js";

@Module({
  imports: [forwardRef(() => AiModelsModule)],
  controllers: [EvidenceController],
  providers: [EvidenceRepository, EvidenceService],
  exports: [EvidenceRepository, EvidenceService]
})
export class EvidenceModule {}
