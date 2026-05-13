import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { MatchingModule } from "../matching/matching.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { ToolsModule } from "../tools/tools.module.js";
import { IntakeOperationsBridgeController } from "./intake-operations-bridge.controller.js";
import { IntakeOperationsBridgeService } from "./intake-operations-bridge.service.js";

@Module({
  imports: [PrismaModule, MatchingModule, PaymentsModule, ToolsModule],
  controllers: [IntakeOperationsBridgeController],
  providers: [IntakeOperationsBridgeService],
  exports: [IntakeOperationsBridgeService],
})
export class IntakeOperationsBridgeModule {}
