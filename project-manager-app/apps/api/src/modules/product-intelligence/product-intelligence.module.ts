import { Module } from "@nestjs/common";
import { ProductIntelligenceController } from "./product-intelligence.controller.js";
import { ProductIntelligenceService } from "./product-intelligence.service.js";

@Module({
  controllers: [ProductIntelligenceController],
  providers: [ProductIntelligenceService],
  exports: [ProductIntelligenceService],
})
export class ProductIntelligenceModule {}
