import { Module, forwardRef } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { DisputesController } from "./disputes.controller.js";
import { DisputesRepository } from "./disputes.repository.js";
import { DisputesService } from "./disputes.service.js";

@Module({
  imports: [DomainEventsModule, KnowledgeModule, forwardRef(() => AiModelsModule)],
  controllers: [DisputesController],
  providers: [DisputesRepository, DisputesService],
  exports: [DisputesRepository, DisputesService]
})
export class DisputesModule {}
