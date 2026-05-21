import { Module } from "@nestjs/common";
import { BlsPpiService } from "./bls-ppi.service.js";
import { MaterialPricingService } from "./material-pricing.service.js";
import { PricingController } from "./pricing.controller.js";
import { PriceRefreshJob } from "./price-refresh.job.js";

@Module({
  providers: [BlsPpiService, MaterialPricingService, PriceRefreshJob],
  controllers: [PricingController],
  exports: [MaterialPricingService],
})
export class PricingModule {}
