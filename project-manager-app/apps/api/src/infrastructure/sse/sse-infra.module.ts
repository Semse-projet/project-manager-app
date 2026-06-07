import { Global, Module } from "@nestjs/common";
import { SseEventBusService } from "./sse-event-bus.service.js";
import { HealthService } from "../../modules/health/health.service.js";

@Global()
@Module({
  providers: [SseEventBusService, HealthService],
  exports: [SseEventBusService, HealthService],
})
export class SseInfraModule {}
