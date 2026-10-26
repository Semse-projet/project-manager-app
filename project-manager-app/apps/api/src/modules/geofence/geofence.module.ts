import { Module } from "@nestjs/common";
import { GeofenceController } from "./geofence.controller.js";
import { GeofenceService } from "./geofence.service.js";

@Module({
  controllers: [GeofenceController],
  providers: [GeofenceService]
})
export class GeofenceModule {}
