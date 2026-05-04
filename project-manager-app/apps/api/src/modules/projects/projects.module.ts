import { forwardRef, Module } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { MilestonesModule } from "../milestones/milestones.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  imports: [JobsModule, MilestonesModule, KnowledgeModule, forwardRef(() => IntelligenceModule), forwardRef(() => AiModelsModule)],
  controllers: [ProjectsController],
  providers: [ProjectsRepository, ProjectsService],
  exports: [ProjectsRepository, ProjectsService],
})
export class ProjectsModule {}
