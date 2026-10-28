import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { LaborEngineController } from "./labor-engine.controller.js";
import { LaborEngineRepository } from "./labor-engine.repository.js";
import { LaborEngineService } from "./labor-engine.service.js";
import { LaborChatService } from "./labor-chat.service.js";
import { MyLaborCorrectionsController, OrgLaborController } from "./labor-policy.controller.js";
import { LaborPolicyService } from "./labor-policy.service.js";

@Module({
  imports: [AiModelsModule, AdminModule],
  controllers: [LaborEngineController, OrgLaborController, MyLaborCorrectionsController],
  providers: [LaborEngineRepository, LaborEngineService, LaborChatService, LaborPolicyService],
  exports: [LaborEngineService],
})
export class LaborEngineModule {}
