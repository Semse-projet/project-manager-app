import { Module } from "@nestjs/common";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { RatingsController } from "./ratings.controller.js";
import { RatingsRepository } from "./ratings.repository.js";
import { RatingsService } from "./ratings.service.js";
import { ReputationService } from "./reputation.service.js";

@Module({
  imports: [DomainEventsModule],
  controllers: [RatingsController],
  providers: [RatingsRepository, RatingsService, ReputationService],
  exports: [RatingsRepository, RatingsService, ReputationService]
})
export class RatingsModule {}
