import { Module, forwardRef } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { MilestonesController } from "./milestones.controller.js";
import { MilestonesRepository } from "./milestones.repository.js";
import { MilestonesService } from "./milestones.service.js";

@Module({
  imports: [DomainEventsModule, KnowledgeModule, forwardRef(() => AiModelsModule)],
  controllers: [MilestonesController],
  providers: [MilestonesRepository, MilestonesService],
  exports: [MilestonesRepository, MilestonesService]
})
export class MilestonesModule {}
