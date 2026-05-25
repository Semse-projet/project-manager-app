import { Module } from "@nestjs/common";
import { RatingsModule } from "../ratings/ratings.module.js";
import { TrustController } from "./trust.controller.js";
import { TrustPassportService } from "./trust-passport.service.js";
import { TrustRepository } from "./trust.repository.js";
import { TrustService } from "./trust.service.js";

@Module({
  imports: [RatingsModule],
  controllers: [TrustController],
  providers: [TrustRepository, TrustService, TrustPassportService],
  exports: [TrustService, TrustPassportService],
})
export class TrustModule {}
