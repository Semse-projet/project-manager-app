import { Module } from "@nestjs/common";
import { RatingsModule } from "../ratings/ratings.module.js";
import { DidController } from "./did.controller.js";
import { DidService } from "./did.service.js";

@Module({
  imports: [RatingsModule],
  controllers: [DidController],
  providers: [DidService],
  exports: [DidService],
})
export class DidModule {}
