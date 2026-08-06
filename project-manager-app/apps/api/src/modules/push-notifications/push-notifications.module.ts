import { Module } from "@nestjs/common";
import { PushNotificationsController } from "./push-notifications.controller.js";
import { PushNotificationsRepository } from "./push-notifications.repository.js";
import { PushNotificationsService } from "./push-notifications.service.js";
import { PushDispatchService } from "./push-dispatch.service.js";

@Module({
  controllers: [PushNotificationsController],
  providers: [PushNotificationsRepository, PushNotificationsService, PushDispatchService],
  exports: [PushNotificationsRepository, PushNotificationsService, PushDispatchService],
})
export class PushNotificationsModule {}
