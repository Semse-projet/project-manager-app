import { Module } from "@nestjs/common";
import { CommunicationsOutboxModule } from "../communications/communications-outbox.module.js";
import { SseInfraModule } from "../../infrastructure/sse/sse-infra.module.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { NotificationsService } from "./notifications.service.js";

@Module({
  imports: [CommunicationsOutboxModule, SseInfraModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository],
  exports: [NotificationsService],
})
export class NotificationsModule {}
