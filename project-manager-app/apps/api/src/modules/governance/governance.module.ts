import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { RatingsModule } from "../ratings/ratings.module.js";
import { GovernanceController } from "./governance.controller.js";
import { GovernanceService } from "./governance.service.js";

@Module({
  imports: [PrismaModule, RatingsModule],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
