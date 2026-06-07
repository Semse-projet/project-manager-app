import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { AssistantService } from "./assistant.service.js";
import { AssistantController } from "./assistant.controller.js";
import { ProjectDraftService } from "./project-draft.service.js";

@Module({
  imports: [PrismaModule, AiModelsModule, IntelligenceModule, JobsModule],
  controllers: [AssistantController],
  providers: [AssistantService, ProjectDraftService],
  exports: [AssistantService, ProjectDraftService],
})
export class AssistantModule {}
