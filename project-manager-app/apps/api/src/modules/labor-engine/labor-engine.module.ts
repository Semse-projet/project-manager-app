import { Module } from "@nestjs/common";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { LaborEngineController } from "./labor-engine.controller.js";
import { LaborEngineRepository } from "./labor-engine.repository.js";
import { LaborEngineService } from "./labor-engine.service.js";
import { LaborChatService } from "./labor-chat.service.js";

@Module({
  imports: [AiModelsModule],
  controllers: [LaborEngineController],
  providers: [LaborEngineRepository, LaborEngineService, LaborChatService],
  exports: [LaborEngineService],
})
export class LaborEngineModule {}
