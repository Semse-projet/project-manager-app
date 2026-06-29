import { Controller, Post, Get, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedAccess } from '../../common/permissions.decorator.js';
import { ChangeOrderService } from './change-order.service.js';

/**
 * Change Order Controller — endpoints para change orders.
 */
@Controller('v1/projects/:projectId/change-orders')
@UseGuards(AuthGuard('jwt'))
@AuthenticatedAccess('Legacy change order endpoints are JWT-protected and pending granular change-order permissions.')
export class ChangeOrderController {
  private readonly logger = new Logger(ChangeOrderController.name);

  constructor(private readonly changeOrderService: ChangeOrderService) {}

  /**
   * POST /v1/projects/:projectId/change-orders
   * Crear nuevo change order (DRAFT).
   */
  @Post()
  async createChangeOrder(
    @Param('projectId') projectId: string,
    @Body() body: { description: string; amount: number }
  ) {
    this.logger.log(`POST /change-orders: ${projectId}`);

    const changeOrder = await this.changeOrderService.createChangeOrder(
      projectId,
      body.description,
      body.amount,
      'user-from-jwt'
    );

    return {
      success: true,
      data: changeOrder,
    };
  }

  /**
   * GET /v1/projects/:projectId/change-orders
   * Obtener todos los change orders del proyecto.
   */
  @Get()
  async getChangeOrders(@Param('projectId') projectId: string) {
    this.logger.log(`GET /change-orders: ${projectId}`);

    const changeOrders = await this.changeOrderService.getChangeOrders(projectId);

    return {
      success: true,
      count: changeOrders.length,
      data: changeOrders,
    };
  }

  /**
   * POST /v1/projects/:projectId/change-orders/:id/submit
   * Enviar para aprobación (DRAFT → PENDING_APPROVAL).
   */
  @Post(':id/submit')
  async submitForApproval(
    @Param('projectId') projectId: string,
    @Param('id') changeOrderId: string
  ) {
    this.logger.log(`POST /change-orders/:id/submit: ${changeOrderId}`);

    const updated = await this.changeOrderService.submitForApproval(
      changeOrderId,
      'user-from-jwt'
    );

    return {
      success: true,
      message: 'Change order submitted for approval',
      data: updated,
    };
  }

  /**
   * POST /v1/projects/:projectId/change-orders/:id/approve
   * Aprobar (PENDING_APPROVAL → APPROVED).
   * Requiere firma PRO.
   */
  @Post(':id/approve')
  async approveChangeOrder(
    @Param('projectId') projectId: string,
    @Param('id') changeOrderId: string,
    @Body() body: { signature: string }
  ) {
    this.logger.log(`POST /change-orders/:id/approve: ${changeOrderId}`);

    const updated = await this.changeOrderService.approveChangeOrder(
      changeOrderId,
      'pro-user-from-jwt',
      body.signature
    );

    return {
      success: true,
      message: 'Change order approved',
      data: updated,
    };
  }

  /**
   * POST /v1/projects/:projectId/change-orders/:id/reject
   * Rechazar (PENDING_APPROVAL → REJECTED).
   */
  @Post(':id/reject')
  async rejectChangeOrder(
    @Param('projectId') projectId: string,
    @Param('id') changeOrderId: string,
    @Body() body: { reason: string }
  ) {
    this.logger.log(`POST /change-orders/:id/reject: ${changeOrderId}`);

    const updated = await this.changeOrderService.rejectChangeOrder(
      changeOrderId,
      'user-from-jwt',
      body.reason
    );

    return {
      success: true,
      message: 'Change order rejected',
      data: updated,
    };
  }

  /**
   * GET /v1/projects/:projectId/change-orders/timeline
   * Obtener timeline para auditoría.
   */
  @Get('timeline/all')
  async getTimeline(@Param('projectId') projectId: string) {
    this.logger.log(`GET /timeline: ${projectId}`);

    const timeline = await this.changeOrderService.getChangeOrderTimeline(projectId);
    const totalApproved = await this.changeOrderService.getTotalApprovedChanges(projectId);

    return {
      success: true,
      totalApprovedAmount: totalApproved,
      count: timeline.length,
      data: timeline,
    };
  }
}
