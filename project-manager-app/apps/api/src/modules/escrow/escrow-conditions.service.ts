// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class EscrowConditionsService {
  private readonly logger = new Logger(EscrowConditionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if draw can be released (all conditions met).
   */
  async canReleaseDraw(drawId: string): Promise<{ can: boolean; reason?: string }> {
    const draw = await this.prisma.drawRequest.findUniqueOrThrow({ where: { id: drawId } });

    // Condition 1: Liens waived
    const liens = await this.prisma.lienNotice.findMany({
      where: { lienCalendarId: draw.projectId },
    });
    if (liens.some((l) => l.status !== 'NOTICE_DELIVERED')) {
      return { can: false, reason: 'Pending liens' };
    }

    // Condition 2: Change orders approved
    const changes = await this.prisma.changeOrder.findMany({
      where: { projectId: draw.projectId },
    });
    if (changes.some((c) => c.status === 'PENDING_APPROVAL')) {
      return { can: false, reason: 'Pending change orders' };
    }

    // Condition 3: No disputes
    // TODO: Check disputes table

    return { can: true };
  }

  /**
   * Release draw if conditions met.
   */
  async conditionalRelease(drawId: string): Promise<{ released: boolean; message: string }> {
    const check = await this.canReleaseDraw(drawId);

    if (!check.can) {
      return { released: false, message: check.reason || 'Conditions not met' };
    }

    await this.prisma.drawRequest.update({
      where: { id: drawId },
      data: { status: 'APPROVED' },
    });

    this.logger.log(`Draw conditionally released: ${drawId}`);
    return { released: true, message: 'Draw approved for funding' };
  }
}
