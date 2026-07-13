import { Module, forwardRef } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { EvidenceController } from "./evidence.controller.js";
import { EvidenceRepository } from "./evidence.repository.js";
import { EvidenceService } from "./evidence.service.js";

@Module({
  imports: [forwardRef(() => AiModelsModule), DomainEventsModule],
  controllers: [EvidenceController],
  providers: [EvidenceRepository, EvidenceService],
  exports: [EvidenceRepository, EvidenceService],
})
export class EvidenceModule {}
