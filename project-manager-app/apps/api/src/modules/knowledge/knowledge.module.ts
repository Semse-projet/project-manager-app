import { Module } from "@nestjs/common";
import { RuntimeKnowledgeModule } from "../runtime-knowledge/runtime-knowledge.module.js";
import { AgentMemoryRepository } from "./agent-memory.repository.js";
import { AgentMemoryService } from "./agent-memory.service.js";
import { AgentSkillRepository } from "./agent-skill.repository.js";
import { KnowledgeController } from "./knowledge.controller.js";
import { KnowledgeCuratorService } from "./knowledge-curator.service.js";
import { KnowledgeService } from "./knowledge.service.js";
import { WorkspaceMemoryAccessPolicy } from "./workspace-memory.access-policy.js";
import { WorkspaceMemoryRepository } from "./workspace-memory.repository.js";

@Module({
  imports: [RuntimeKnowledgeModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, WorkspaceMemoryRepository, WorkspaceMemoryAccessPolicy, AgentMemoryRepository, AgentMemoryService, KnowledgeCuratorService, AgentSkillRepository],
  exports: [WorkspaceMemoryRepository, WorkspaceMemoryAccessPolicy, AgentMemoryRepository, AgentMemoryService, KnowledgeCuratorService, AgentSkillRepository]
})
export class KnowledgeModule {}
