import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { BuildOpsController } from "./buildops.controller.js";
import { BuildOpsService } from "./buildops.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [BuildOpsController],
  providers: [BuildOpsService],
  exports: [BuildOpsService],
})
export class BuildOpsModule {}

