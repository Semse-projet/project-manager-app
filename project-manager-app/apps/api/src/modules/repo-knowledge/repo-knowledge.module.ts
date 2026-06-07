import { Module } from "@nestjs/common";
import { RepoKnowledgeController } from "./repo-knowledge.controller.js";
import { RepoKnowledgeService } from "./repo-knowledge.service.js";

@Module({
  controllers: [RepoKnowledgeController],
  providers: [RepoKnowledgeService],
  exports: [RepoKnowledgeService]
})
export class RepoKnowledgeModule {}
