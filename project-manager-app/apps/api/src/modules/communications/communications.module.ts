import { Module } from "@nestjs/common";
import { ContractorModule } from "../contractor/contractor.module.js";
import { SmartIntakeModule } from "../smart-intake/smart-intake.module.js";
import { CommunicationsOutboxModule } from "./communications-outbox.module.js";
import { CommunicationsController } from "./communications.controller.js";
import { CommunicationsService } from "./communications.service.js";
import { WhatsAppCloudAdapter } from "./providers/whatsapp-cloud.adapter.js";

@Module({
  imports: [CommunicationsOutboxModule, ContractorModule, SmartIntakeModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, WhatsAppCloudAdapter],
  exports: [CommunicationsService, WhatsAppCloudAdapter],
})
export class CommunicationsModule {}
