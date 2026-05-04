import { Module } from "@nestjs/common";
import { RuntimeKnowledgeController } from "./runtime-knowledge.controller.js";
import { RuntimeKnowledgeService } from "./runtime-knowledge.service.js";

@Module({
  controllers: [RuntimeKnowledgeController],
  providers: [RuntimeKnowledgeService],
  exports: [RuntimeKnowledgeService]
})
export class RuntimeKnowledgeModule {}

