import { Module } from "@nestjs/common";
import { LiveSessionsController } from "./live-sessions.controller.js";
import { LiveKitWebhookController } from "./livekit-webhook.controller.js";
import { LiveSessionsService } from "./live-sessions.service.js";
import { LiveKitService } from "./livekit.service.js";
import {
  LIVE_SESSIONS_REPOSITORY,
  PrismaLiveSessionsRepository,
} from "./live-sessions.repository.js";
import {
  LIVE_SESSIONS_RESOURCE_ACCESS,
  PrismaLiveSessionResourceAccess,
} from "./live-sessions.resource-access.js";

@Module({
  controllers: [LiveSessionsController, LiveKitWebhookController],
  providers: [
    LiveSessionsService,
    LiveKitService,
    { provide: LIVE_SESSIONS_REPOSITORY, useClass: PrismaLiveSessionsRepository },
    { provide: LIVE_SESSIONS_RESOURCE_ACCESS, useClass: PrismaLiveSessionResourceAccess },
  ],
  exports: [LiveSessionsService],
})
export class LiveSessionsModule {}
