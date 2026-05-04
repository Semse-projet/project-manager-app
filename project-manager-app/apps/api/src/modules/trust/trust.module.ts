import { Module } from "@nestjs/common";
import { TrustController } from "./trust.controller.js";
import { TrustRepository } from "./trust.repository.js";
import { TrustService } from "./trust.service.js";

@Module({
  controllers: [TrustController],
  providers: [TrustRepository, TrustService],
  exports: [TrustService]
})
export class TrustModule {}
