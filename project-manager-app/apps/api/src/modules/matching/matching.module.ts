import { Module } from "@nestjs/common";
import { MatchingController } from "./matching.controller.js";
import { MatchingRepository } from "./matching.repository.js";
import { MatchingService } from "./matching.service.js";

@Module({
  controllers: [MatchingController],
  providers: [MatchingRepository, MatchingService],
  exports: [MatchingService]
})
export class MatchingModule {}
