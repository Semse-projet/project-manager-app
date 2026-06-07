import { Module } from "@nestjs/common";
import { AgentQueueService } from "./agent-queue.service.js";
import { DeveloperRuntimeQueueService } from "./developer-runtime-queue.service.js";

@Module({
  providers: [AgentQueueService, DeveloperRuntimeQueueService],
  exports: [AgentQueueService, DeveloperRuntimeQueueService]
})
export class AgentQueueModule {}
