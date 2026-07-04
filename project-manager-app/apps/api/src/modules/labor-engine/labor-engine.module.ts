import { Module } from "@nestjs/common";
import { LaborEngineController } from "./labor-engine.controller.js";
import { LaborEngineRepository } from "./labor-engine.repository.js";
import { LaborEngineService } from "./labor-engine.service.js";

@Module({
  controllers: [LaborEngineController],
  providers: [LaborEngineRepository, LaborEngineService],
  exports: [LaborEngineService],
})
export class LaborEngineModule {}
