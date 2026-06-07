import { Module } from "@nestjs/common";
import { TravelController } from "./travel.controller.js";
import { TravelService } from "./travel.service.js";

@Module({
  controllers: [TravelController],
  providers: [TravelService],
  exports: [TravelService],
})
export class TravelModule {}
