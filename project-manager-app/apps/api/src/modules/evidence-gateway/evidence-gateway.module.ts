import { Module } from "@nestjs/common";
import { EvidenceGatewayController } from "./evidence-gateway.controller.js";
import { EvidenceGatewayService } from "./evidence-gateway.service.js";
import { EvidenceGatewayRepository } from "./evidence-gateway.repository.js";
import { SseModule } from "../../infrastructure/sse/sse.module.js";

@Module({
  imports: [SseModule],
  controllers: [EvidenceGatewayController],
  providers: [EvidenceGatewayService, EvidenceGatewayRepository],
  exports: [EvidenceGatewayService],
})
export class EvidenceGatewayModule {}
