import { Module } from "@nestjs/common";
import { SatelliteAppGuard } from "./satellite-app.guard.js";
import { SatelliteScopeGuard } from "./satellite-scope.guard.js";
import { SatellitesController } from "./satellites.controller.js";
import { SatellitesService } from "./satellites.service.js";

@Module({
  controllers: [SatellitesController],
  providers: [SatellitesService, SatelliteScopeGuard, SatelliteAppGuard],
  exports: [SatellitesService, SatelliteScopeGuard, SatelliteAppGuard]
})
export class SatellitesModule {}
