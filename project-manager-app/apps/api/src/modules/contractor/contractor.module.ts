import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { ContractorService } from "./contractor.service.js";
import { ContractorController } from "./contractor.controller.js";
import { ContractorEstimateService } from "./contractor-estimate.service.js";

@Module({
  imports: [PrismaModule, AiModelsModule, FinanceModule],
  controllers: [ContractorController],
  providers: [ContractorService, ContractorEstimateService],
  exports: [ContractorService, ContractorEstimateService],
})
export class ContractorModule {}
