import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { SseInfraModule } from "../../infrastructure/sse/sse-infra.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { ContributorProgramController } from "./contributor-program.controller.js";
import { ContributorProgramRepository } from "./contributor-program.repository.js";
import { ContributorProgramService } from "./contributor-program.service.js";

@Module({
  imports: [PrismaModule, SseInfraModule, PaymentsModule],
  controllers: [ContributorProgramController],
  providers: [ContributorProgramRepository, ContributorProgramService],
  exports: [ContributorProgramService]
})
export class ContributorProgramModule {}
