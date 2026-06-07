import { Module } from "@nestjs/common";
import { BlsPpiService } from "./bls-ppi.service.js";
import { MaterialPricingService } from "./material-pricing.service.js";
import { PricingController } from "./pricing.controller.js";
import { PriceRefreshJob } from "./price-refresh.job.js";
import { OewsService } from "./oews.service.js";
import { LocationCostService } from "./location-cost.service.js";
import { ContractorRateService } from "./contractor-rate.service.js";

@Module({
  providers: [BlsPpiService, MaterialPricingService, PriceRefreshJob, OewsService, LocationCostService, ContractorRateService],
  controllers: [PricingController],
  exports: [MaterialPricingService, LocationCostService, ContractorRateService],
})
export class PricingModule {}
