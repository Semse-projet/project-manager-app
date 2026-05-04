import { forwardRef, Module, OnModuleInit, Logger } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { FinanceRepository } from "./finance.repository.js";
import { FinanceService } from "./finance.service.js";
import { FinanceController } from "./finance.controller.js";
import { ReceiptOcrService } from "./receipt-ocr.service.js";

const OVERDUE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

@Module({
  imports: [PrismaModule, forwardRef(() => AiModelsModule)],
  providers: [FinanceRepository, FinanceService, ReceiptOcrService],
  controllers: [FinanceController],
  exports: [FinanceService, ReceiptOcrService],
})
export class FinanceModule implements OnModuleInit {
  private readonly logger = new Logger(FinanceModule.name);

  constructor(private readonly financeService: FinanceService) {}

  onModuleInit() {
    void this.financeService.markOverdueInvoices().then(n => {
      if (n > 0) this.logger.warn(`[finance] ${n} invoice(s) marked overdue on startup`);
    }).catch(() => {});

    setInterval(() => {
      void this.financeService.markOverdueInvoices().then(n => {
        if (n > 0) this.logger.warn(`[finance] ${n} invoice(s) marked overdue`);
      }).catch(() => {});
    }, OVERDUE_CHECK_INTERVAL_MS);
  }
}
