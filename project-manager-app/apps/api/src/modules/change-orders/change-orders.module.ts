import { Module } from "@nestjs/common";
import { OperationalIntelligenceModule } from "../operational-intelligence/operational-intelligence.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { ChangeOrdersController } from "./change-orders.controller.js";
import { ChangeOrdersService } from "./change-orders.service.js";

@Module({
  imports: [OperationalIntelligenceModule, PaymentsModule],
  controllers: [ChangeOrdersController],
  providers: [ChangeOrdersService],
  exports: [ChangeOrdersService],
})
export class ChangeOrdersModule {}
