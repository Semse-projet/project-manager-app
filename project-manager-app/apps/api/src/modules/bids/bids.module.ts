import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { JobsModule } from "../jobs/jobs.module.js";
import { BidsController } from "./bids.controller.js";
import { BidsRepository } from "./bids.repository.js";
import { BidsService } from "./bids.service.js";

@Module({
  imports: [PrismaModule, JobsModule],
  controllers: [BidsController],
  providers: [BidsRepository, BidsService],
})
export class BidsModule {}
