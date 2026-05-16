import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { EvidenceModule } from "../evidence/evidence.module.js";
import { IntakeOperationsBridgeModule } from "../intake-operations-bridge/intake-operations-bridge.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { SmartIntakeController } from "./smart-intake.controller.js";
import { SmartIntakeService } from "./smart-intake.service.js";

@Module({
  imports: [PrismaModule, JobsModule, EvidenceModule, IntakeOperationsBridgeModule],
  controllers: [SmartIntakeController],
  providers: [SmartIntakeService],
  exports: [SmartIntakeService],
})
export class SmartIntakeModule {}

