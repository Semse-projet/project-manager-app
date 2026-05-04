import { Global, Module } from "@nestjs/common";
import { MetricsController } from "./metrics.controller.js";
import { MetricsService } from "./metrics.service.js";
import { SemseLoggerService } from "./semse-logger.service.js";

@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, SemseLoggerService],
  exports: [MetricsService, SemseLoggerService]
})
export class ObservabilityModule {}
