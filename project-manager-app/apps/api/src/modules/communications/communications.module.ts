import { Module } from "@nestjs/common";
import { ContractorModule } from "../contractor/contractor.module.js";
import { SmartIntakeModule } from "../smart-intake/smart-intake.module.js";
import { CommunicationsOutboxModule } from "./communications-outbox.module.js";
import { CommunicationsController } from "./communications.controller.js";
import { CommunicationsService } from "./communications.service.js";

@Module({
  imports: [CommunicationsOutboxModule, ContractorModule, SmartIntakeModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
