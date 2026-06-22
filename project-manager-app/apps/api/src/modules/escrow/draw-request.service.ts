import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';

/**
 * DrawRequestService — Multi-stage escrow releases (draws).
 * Draw 1-4 con retainage hold.
 */

@Injectable()
export class DrawRequestService {
  private readonly logger = new Logger(DrawRequestService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear draw request (DRAFT).
   */
  async createDraw(
    projectId: string,
    drawNumber: number,
    amount: number,
    percentage: number,
    createdBy: string
  ): Promise<any> {
    this.logger.log(`Creating draw: ${projectId} / Draw #${drawNumber}`, { amount, percentage });

    // Calcular retainage (10% estándar)
    const retainagePercentage = drawNumber === 4 ? 0 : 0.1;
    const retaiange = Math.round(amount * retainagePercentage);

    const draw = await this.prisma.drawRequest.create({
      data: {
        projectId,
        drawNumber,
        amount,
        percentage,
        retainage: retaiange,
        status: 'DRAFT',
        createdBy,
      },
    });

    return draw;
  }

  /**
   * Enviar draw para aprobación de lender.
   * DRAFT → PENDING_LENDER
   */
  async submitForApproval(drawId: string, submittedBy: string): Promise<any> {
    this.logger.log(`Submitting draw for approval: ${drawId}`);

    const updated = await this.prisma.drawRequest.update({
      where: { id: drawId },
      data: {
        status: 'PENDING_LENDER',
        submittedBy,
        submittedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Aprobar draw (PENDING_LENDER → APPROVED).
   */
  async approveDraw(drawId: string, approvedBy: string): Promise<any> {
    this.logger.log(`Approving draw: ${drawId}`);

    const updated = await this.prisma.drawRequest.update({
      where: { id: drawId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Rechazar draw.
   */
  async rejectDraw(drawId: string, rejectionReason: string): Promise<any> {
    this.logger.log(`Rejecting draw: ${drawId}`, { reason: rejectionReason });

    const updated = await this.prisma.drawRequest.update({
      where: { id: drawId },
      data: {
        status: 'REJECTED',
        rejectionReason,
      },
    });

    return updated;
  }

  /**
   * Fundar draw (APPROVED → FUNDED).
   */
  async fundDraw(drawId: string, transactionId: string): Promise<any> {
    this.logger.log(`Funding draw: ${drawId}`, { transactionId });

    const updated = await this.prisma.drawRequest.update({
      where: { id: drawId },
      data: {
        status: 'FUNDED',
        fundedAt: new Date(),
        fundingTransactionId: transactionId,
      },
    });

    return updated;
  }

  /**
   * Obtener draws de un proyecto.
   */
  async getProjectDraws(projectId: string): Promise<any[]> {
    return await this.prisma.drawRequest.findMany({
      where: { projectId },
      orderBy: { drawNumber: 'asc' },
    });
  }

  /**
   * Calcular total retainage de un proyecto.
   */
  async getTotalRetainage(projectId: string): Promise<number> {
    const draws = await this.getProjectDraws(projectId);
    return draws.reduce((sum, d) => sum + (d.retainage || 0), 0);
  }

  /**
   * Calcular monto total fundido.
   */
  async getTotalFunded(projectId: string): Promise<number> {
    const draws = await this.getProjectDraws(projectId);
    const funded = draws
      .filter((d) => d.status === 'FUNDED')
      .reduce((sum, d) => sum + (d.amount - (d.retainage || 0)), 0);

    return funded;
  }

  /**
   * Calcular próximo draw disponible.
   */
  async getNextDrawNumber(projectId: string): Promise<number> {
    const draws = await this.getProjectDraws(projectId);
    const maxDraw = Math.max(0, ...draws.map((d) => d.drawNumber));
    return Math.min(maxDraw + 1, 4); // Max 4 draws
  }
}
