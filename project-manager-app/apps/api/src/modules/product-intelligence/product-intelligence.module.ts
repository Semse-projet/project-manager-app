import { Module } from "@nestjs/common";
import { OperationalIntelligenceModule } from "../operational-intelligence/operational-intelligence.module.js";
import { ProductIntelligenceController } from "./product-intelligence.controller.js";
import { ProductIntelligenceService } from "./product-intelligence.service.js";

@Module({
  imports: [OperationalIntelligenceModule],
  controllers: [ProductIntelligenceController],
  providers: [ProductIntelligenceService],
  exports: [ProductIntelligenceService],
})
export class ProductIntelligenceModule {}
