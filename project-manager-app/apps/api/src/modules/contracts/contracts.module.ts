import { Module } from "@nestjs/common";
import { ContractsController } from "./contracts.controller.js";
import { ContractsRepository } from "./contracts.repository.js";
import { ContractsService } from "./contracts.service.js";
import { ContractTemplateService } from "./contract-template.service.js";
import { HelloSignService } from "./hellosign.service.js";
import { ReservationsModule } from "../reservations/reservations.module.js";

@Module({
  imports: [ReservationsModule],
  controllers: [ContractsController],
  providers: [ContractsRepository, ContractsService, ContractTemplateService, HelloSignService],
  exports: [ContractsRepository, ContractsService, ContractTemplateService, HelloSignService]
})
export class ContractsModule {}
