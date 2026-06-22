import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';

/**
 * ChangeOrderService — track cambios en proyectos (change orders).
 * Change orders requieren aprobación PRO + GC.
 */

@Injectable()
export class ChangeOrderService {
  private readonly logger = new Logger(ChangeOrderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear change order.
   */
  async createChangeOrder(
    projectId: string,
    description: string,
    amount: number,
    createdBy: string
  ): Promise<any> {
    this.logger.log(`Creating change order: ${projectId}`, { description, amount });

    const changeOrder = await this.prisma.changeOrder.create({
      data: {
        projectId,
        description,
        amount,
        status: 'DRAFT',
        createdBy,
        createdAt: new Date(),
      },
    });

    return changeOrder;
  }

  /**
   * Obtener change orders de un proyecto.
   */
  async getChangeOrders(projectId: string): Promise<any[]> {
    return await this.prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Proponer cambio (DRAFT → PENDING_APPROVAL).
   */
  async submitForApproval(changeOrderId: string, submittedBy: string): Promise<any> {
    this.logger.log(`Submitting change order for approval: ${changeOrderId}`);

    const updated = await this.prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: {
        status: 'PENDING_APPROVAL',
        submittedBy,
        submittedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Aprobar change order (PENDING_APPROVAL → APPROVED).
   * Requiere firma PRO.
   */
  async approveChangeOrder(
    changeOrderId: string,
    approvedBy: string,
    signature: string
  ): Promise<any> {
    this.logger.log(`Approving change order: ${changeOrderId}`);

    const updated = await this.prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
        proSignature: signature,
      },
    });

    return updated;
  }

  /**
   * Rechazar change order (PENDING_APPROVAL → REJECTED).
   */
  async rejectChangeOrder(changeOrderId: string, rejectedBy: string, reason: string): Promise<any> {
    this.logger.log(`Rejecting change order: ${changeOrderId}`, { reason });

    const updated = await this.prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    return updated;
  }

  /**
   * Obtener timeline de change orders (para auditoría).
   */
  async getChangeOrderTimeline(projectId: string): Promise<any[]> {
    const changeOrders = await this.prisma.changeOrder.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    return changeOrders.map((co) => ({
      id: co.id,
      date: co.createdAt,
      description: co.description,
      amount: co.amount,
      status: co.status,
      createdBy: co.createdBy,
      approvedBy: co.approvedBy,
    }));
  }

  /**
   * Calcular total de cambios aprobados (impacto presupuestal).
   */
  async getTotalApprovedChanges(projectId: string): Promise<number> {
    const result = await this.prisma.changeOrder.aggregate({
      where: { projectId, status: 'APPROVED' },
      _sum: { amount: true },
    });

    return result._sum?.amount || 0;
  }
}
