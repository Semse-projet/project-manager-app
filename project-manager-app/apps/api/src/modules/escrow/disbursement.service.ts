// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class DisbursementService {
  private readonly logger = new Logger(DisbursementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process automatic ACH/wire transfer.
   */
  async processDisbursement(drawId: string, bankInfo: any): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    const draw = await this.prisma.drawRequest.findUniqueOrThrow({ where: { id: drawId } });

    if (draw.status !== 'APPROVED') {
      return { success: false, error: 'Draw not approved' };
    }

    try {
      // Simulated ACH processing
      const transactionId = `ACH_${Date.now()}`;
      const amount = draw.amount - (draw.retainage || 0);

      await this.prisma.drawRequest.update({
        where: { id: drawId },
        data: {
          status: 'FUNDED',
          fundedAt: new Date(),
          fundingTransactionId: transactionId,
        },
      });

      this.logger.log(`Disbursement processed: ${drawId}`, { amount, transactionId });
      return { success: true, transactionId };
    } catch (error) {
      this.logger.error(`Disbursement failed: ${drawId}`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Batch process multiple draws.
   */
  async batchDisbursement(drawIds: string[]): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (const drawId of drawIds) {
      const result = await this.processDisbursement(drawId, {});
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    this.logger.log(`Batch disbursement complete`, { processed, failed });
    return { processed, failed };
  }
}
