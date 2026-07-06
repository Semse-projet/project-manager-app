import { Module } from "@nestjs/common";
import { SatelliteScopeGuard } from "./satellite-scope.guard.js";
import { SatellitesController } from "./satellites.controller.js";
import { SatellitesService } from "./satellites.service.js";

@Module({
  controllers: [SatellitesController],
  providers: [SatellitesService, SatelliteScopeGuard],
  exports: [SatellitesService, SatelliteScopeGuard]
})
export class SatellitesModule {}
