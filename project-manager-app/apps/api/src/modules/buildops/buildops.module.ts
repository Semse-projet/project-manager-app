import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { BuildOpsPlanApprovalService } from "./buildops-plan-approval.service.js";
import { BuildOpsController } from "./buildops.controller.js";
import { BuildOpsService } from "./buildops.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [BuildOpsController],
  providers: [BuildOpsService, BuildOpsPlanApprovalService],
  exports: [BuildOpsService, BuildOpsPlanApprovalService],
})
export class BuildOpsModule {}
