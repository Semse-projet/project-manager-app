import { Module, forwardRef } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { JobsController } from "./jobs.controller.js";
import { JobsRepository } from "./jobs.repository.js";
import { JobsService } from "./jobs.service.js";

@Module({
  imports: [DomainEventsModule, KnowledgeModule, forwardRef(() => AiModelsModule)],
  controllers: [JobsController],
  providers: [JobsRepository, JobsService],
  exports: [JobsRepository, JobsService]
})
export class JobsModule {}
