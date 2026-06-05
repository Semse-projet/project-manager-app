import { Module } from "@nestjs/common";
import { PaymentGovernanceController } from "./payment-governance.controller.js";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { PaymentGovernanceRepository } from "./payment-governance.repository.js";
import { PaymentGovernanceDiagnosticsService } from "./diagnostics.service.js";
import { SseModule } from "../../infrastructure/sse/sse.module.js";

@Module({
  imports: [SseModule],
  controllers: [PaymentGovernanceController],
  providers: [
    PaymentGovernanceService,
    PaymentGovernanceRepository,
    PaymentGovernanceDiagnosticsService,
  ],
  exports: [PaymentGovernanceService],
})
export class PaymentGovernanceModule {}
