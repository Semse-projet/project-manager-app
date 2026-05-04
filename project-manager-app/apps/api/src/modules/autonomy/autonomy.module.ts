import { Module } from "@nestjs/common";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { AutonomyController } from "./autonomy.controller.js";
import { AutonomyRepository } from "./autonomy.repository.js";
import { AutonomyService } from "./autonomy.service.js";

@Module({
  imports: [KnowledgeModule],
  controllers: [AutonomyController],
  providers: [AutonomyRepository, AutonomyService],
  exports: [AutonomyRepository, AutonomyService]
})
export class AutonomyModule {}
