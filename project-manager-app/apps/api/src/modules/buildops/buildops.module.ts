import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { BuildOpsLegacyPromotionService } from "./buildops-legacy-promotion.service.js";
import { BuildOpsPlanApprovalService } from "./buildops-plan-approval.service.js";
import { BuildOpsController } from "./buildops.controller.js";
import { BuildOpsService } from "./buildops.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [BuildOpsController],
  providers: [BuildOpsService, BuildOpsPlanApprovalService, BuildOpsLegacyPromotionService],
  exports: [BuildOpsService, BuildOpsPlanApprovalService, BuildOpsLegacyPromotionService],
})
export class BuildOpsModule {}
