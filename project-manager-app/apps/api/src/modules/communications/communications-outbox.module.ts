import { Module } from "@nestjs/common";
import { CommunicationsOutboxService } from "./communications-outbox.service.js";
import { CommunicationsRepository } from "./communications.repository.js";
import { WhatsAppCloudAdapter } from "./providers/whatsapp-cloud.adapter.js";

@Module({
  providers: [CommunicationsOutboxService, CommunicationsRepository, WhatsAppCloudAdapter],
  exports: [CommunicationsOutboxService, CommunicationsRepository, WhatsAppCloudAdapter],
})
export class CommunicationsOutboxModule {}
