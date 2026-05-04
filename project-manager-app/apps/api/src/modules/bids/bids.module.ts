import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module.js";
import { BidsController } from "./bids.controller.js";
import { BidsRepository } from "./bids.repository.js";
import { BidsService } from "./bids.service.js";

@Module({
  imports: [JobsModule],
  controllers: [BidsController],
  providers: [BidsRepository, BidsService]
})
export class BidsModule {}
