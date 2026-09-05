import { Module } from "@nestjs/common";
import { SatelliteAppGuard } from "./satellite-app.guard.js";
import { SatelliteScopeGuard } from "./satellite-scope.guard.js";
import { SatelliteWebhooksController } from "./satellite-webhooks.controller.js";
import { SatelliteWebhooksService } from "./satellite-webhooks.service.js";
import { SatellitesController } from "./satellites.controller.js";
import { SatellitesService } from "./satellites.service.js";

@Module({
  controllers: [SatellitesController, SatelliteWebhooksController],
  providers: [SatellitesService, SatelliteWebhooksService, SatelliteScopeGuard, SatelliteAppGuard],
  exports: [SatellitesService, SatelliteWebhooksService, SatelliteScopeGuard, SatelliteAppGuard]
})
export class SatellitesModule {}
