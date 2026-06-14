import { Module } from "@nestjs/common";
import { GraphifyModule } from "../graphify/graphify.module.js";
import { RepoKnowledgeController } from "./repo-knowledge.controller.js";
import { RepoKnowledgeService } from "./repo-knowledge.service.js";

@Module({
  imports: [GraphifyModule],
  controllers: [RepoKnowledgeController],
  providers: [RepoKnowledgeService],
  exports: [RepoKnowledgeService]
})
export class RepoKnowledgeModule {}
