import { Module } from "@nestjs/common";
import { SseController } from "./sse.controller.js";
import { AgentsModule } from "../../modules/agents/agents.module.js";

@Module({
  imports: [AgentsModule],
  controllers: [SseController],
})
export class SseModule {}
