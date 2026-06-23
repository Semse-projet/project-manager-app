import { Module } from "@nestjs/common";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroFarmController } from "./agro-farm.controller.js";
import { AgroFarmRepository } from "./agro-farm.repository.js";
import { AgroFarmService } from "./agro-farm.service.js";

@Module({
  controllers: [AgroFarmController],
  providers: [AgroFarmRepository, AgroAuditRepository, AgroFarmService],
  exports: [AgroFarmService, AgroAuditRepository],
})
export class AgroModule {}
