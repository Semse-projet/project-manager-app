import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { IntakeOperationsBridgeModule } from "../intake-operations-bridge/intake-operations-bridge.module.js";
import { BuildOpsLegacyPromotionService } from "./buildops-legacy-promotion.service.js";
import { BuildOpsPlanApprovalService } from "./buildops-plan-approval.service.js";
import { BuildOpsPlanRerunService } from "./buildops-plan-rerun.service.js";
import { BuildOpsController } from "./buildops.controller.js";
import { BuildOpsService } from "./buildops.service.js";

@Module({
  imports: [PrismaModule, IntakeOperationsBridgeModule],
  controllers: [BuildOpsController],
  providers: [BuildOpsService, BuildOpsPlanApprovalService, BuildOpsLegacyPromotionService, BuildOpsPlanRerunService],
  exports: [BuildOpsService, BuildOpsPlanApprovalService, BuildOpsLegacyPromotionService, BuildOpsPlanRerunService],
})
export class BuildOpsModule {}
