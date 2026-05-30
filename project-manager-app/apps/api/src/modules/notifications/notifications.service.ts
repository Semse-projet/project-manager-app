import { Injectable, Logger, Optional } from "@nestjs/common";
import { CommunicationsOutboxService } from "../communications/communications-outbox.service.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";

type NotificationEventPayload = Record<string, unknown>;

type NotificationSpec = {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

function extractStr(payload: NotificationEventPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Maps a domain event to zero or more notification specs.
 * Only creates notifications when there is a clear recipient userId.
 */
function mapEventToNotifications(
  eventType: string,
  payload: NotificationEventPayload,
): NotificationSpec[] {
  switch (eventType) {
    case "milestone.submitted": {
      const clientUserId = extractStr(payload, "clientUserId");
      if (!clientUserId) return [];
      return [{
        userId: clientUserId,
        type: "milestone_submitted",
        title: "Nuevo hito listo para revisión",
        body: "El profesional subió evidencia para un hito. Revisa y aprueba o solicita cambios.",
        payload: {
          milestoneId: payload.milestoneId,
          projectId: payload.projectId,
          jobId: payload.jobId,
        },
      }];
    }

    case "milestone.approved": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "milestone_approved",
        title: "Hito aprobado",
        body: "El cliente aprobó tu entrega. El pago del hito puede liberarse.",
        payload: {
          milestoneId: payload.milestoneId,
          projectId: payload.projectId,
        },
      }];
    }

    case "milestone.rejected": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "milestone_rejected",
        title: "Hito rechazado",
        body: "El cliente solicitó cambios en el hito. Revisa los comentarios y sube nueva evidencia.",
        payload: {
          milestoneId: payload.milestoneId,
          projectId: payload.projectId,
          reason: payload.reason,
        },
      }];
    }

    case "payment.released": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "payment_released",
        title: "Pago liberado",
        body: "Se liberó el pago de un hito. El monto estará disponible según tu método de cobro.",
        payload: {
          milestoneId: payload.milestoneId,
          projectId: payload.projectId,
          amount: payload.amount,
          currency: payload.currency,
        },
      }];
    }

    case "dispute.opened": {
      const raisedById = extractStr(payload, "raisedById");
      const notifications: NotificationSpec[] = [];

      // Notify the party that did NOT raise the dispute
      const counterpartUserId = extractStr(payload, "counterpartUserId");
      if (counterpartUserId && counterpartUserId !== raisedById) {
        notifications.push({
          userId: counterpartUserId,
          type: "dispute_opened",
          title: "Se abrió una disputa en tu proyecto",
          body: "La otra parte abrió una disputa. Un operador revisará el caso.",
          payload: {
            disputeId: payload.disputeId,
            projectId: payload.projectId,
            jobId: payload.jobId,
            reason: payload.reason,
          },
        });
      }

      // Also notify ops admin via a system notification (userId = raisedById is a placeholder;
      // real fan-out to OPS role comes in a future iteration)
      if (raisedById) {
        notifications.push({
          userId: raisedById,
          type: "dispute_opened_confirmation",
          title: "Disputa registrada",
          body: "Tu disputa fue registrada correctamente. Un operador la revisará pronto.",
          payload: {
            disputeId: payload.disputeId,
            projectId: payload.projectId,
          },
        });
      }

      return notifications;
    }

    case "reservation.created": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "reservation_created",
        title: "Nueva solicitud de reserva",
        body: "Un cliente quiere reservar tus servicios. Tienes tiempo limitado para responder.",
        payload: {
          reservationId: payload.reservationId,
          jobId: payload.jobId,
          clientUserId: payload.clientUserId,
        },
      }];
    }

    case "dispute.evidence_submitted": {
      const assigneeUserId = extractStr(payload, "assigneeUserId");
      if (!assigneeUserId) return [];
      return [{
        userId: assigneeUserId,
        type: "dispute_evidence_submitted",
        title: "Evidencia adjuntada a la disputa",
        body: "Una de las partes adjuntó evidencia adicional. Revisa antes de continuar.",
        payload: {
          disputeId: payload.disputeId,
          projectId: payload.projectId,
          evidenceCount: payload.totalEvidenceCount,
        },
      }];
    }

    case "dispute.under_review": {
      const assigneeUserId = extractStr(payload, "assigneeUserId");
      if (!assigneeUserId) return [];
      return [{
        userId: assigneeUserId,
        type: "dispute_under_review",
        title: "Disputa en revisión",
        body: "La disputa está en revisión formal. Tienes toda la evidencia disponible para emitir resolución.",
        payload: {
          disputeId: payload.disputeId,
          projectId: payload.projectId,
          evidenceCount: payload.evidenceCount,
        },
      }];
    }

    case "dispute.resolved": {
      const raisedById = extractStr(payload, "raisedById");
      const notifications: NotificationSpec[] = [];
      if (raisedById) {
        notifications.push({
          userId: raisedById,
          type: "dispute_resolved",
          title: "Disputa resuelta",
          body: "La disputa fue resuelta por el operador. Revisa la resolución.",
          payload: {
            disputeId: payload.disputeId,
            projectId: payload.projectId,
            resolution: payload.resolution,
            resolutionType: payload.resolutionType,
          },
        });
      }
      return notifications;
    }

    case "job.assigned": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "job_assigned",
        title: "Trabajo asignado",
        body: "Se te asignó un trabajo. Revisa los detalles y comienza cuando estés listo.",
        payload: {
          jobId: payload.jobId,
          projectId: payload.projectId,
        },
      }];
    }

    case "buildops.plan.approved": {
      // Client approved the plan — notify the OPS user who created it
      const opsUserId = extractStr(payload, "createdBy");
      if (!opsUserId) return [];
      return [{
        userId: opsUserId,
        type: "buildops_plan_approved",
        title: "Plan aprobado por el cliente",
        body: "El cliente aprobó el plan de obra. Puedes proceder con la promoción.",
        payload: {
          buildOpsProjectId: payload.buildOpsProjectId,
          jobId: payload.jobId,
          approvedAt: payload.approvedAt,
        },
      }];
    }

    case "buildops.plan.changes_requested": {
      // Client requested changes — notify the OPS user who created the plan
      const opsUserId = extractStr(payload, "createdBy");
      if (!opsUserId) return [];
      return [{
        userId: opsUserId,
        type: "buildops_plan_changes_requested",
        title: "El cliente solicitó cambios en el plan",
        body: typeof payload.comment === "string" && payload.comment
          ? `Comentario: ${payload.comment}`
          : "El cliente revisó el plan y solicitó ajustes antes de aprobar.",
        payload: {
          buildOpsProjectId: payload.buildOpsProjectId,
          jobId: payload.jobId,
          comment: payload.comment,
          reviewedAt: payload.reviewedAt,
        },
      }];
    }

    case "buildops.plan.rejected": {
      // Client rejected the plan — notify the OPS user who created it
      const opsUserId = extractStr(payload, "createdBy");
      if (!opsUserId) return [];
      return [{
        userId: opsUserId,
        type: "buildops_plan_rejected",
        title: "El cliente rechazó el plan",
        body: typeof payload.comment === "string" && payload.comment
          ? `Motivo: ${payload.comment}`
          : "El cliente rechazó el plan de obra. Revisa el caso antes de generar un nuevo plan.",
        payload: {
          buildOpsProjectId: payload.buildOpsProjectId,
          jobId: payload.jobId,
          comment: payload.comment,
          reviewedAt: payload.reviewedAt,
        },
      }];
    }

    case "buildops.plan.rerun_completed": {
      const actorUserId = extractStr(payload, "actorUserId");
      if (!actorUserId) return [];
      return [{
        userId: actorUserId,
        type: "buildops_plan_rerun_completed",
        title: "Nueva versión del plan lista",
        body: `El plan fue regenerado (v${payload.activeVersionNumber ?? "?"}) y está pendiente de aprobación del cliente.`,
        payload: {
          buildOpsProjectId: payload.buildOpsProjectId,
          activeVersionId: payload.activeVersionId,
          activeVersionNumber: payload.activeVersionNumber,
          rerunCompletedAt: payload.rerunCompletedAt,
        },
      }];
    }

    // ── Bids / Proposals ────────────────────────────────────────────────────
    case "bid.submitted": {
      const clientUserId = extractStr(payload, "clientUserId");
      if (!clientUserId) return [];
      return [{
        userId: clientUserId,
        type: "bid_submitted",
        title: "Nueva propuesta recibida",
        body: "Un profesional envió una propuesta para tu proyecto. Revisa los detalles y compara.",
        payload: { jobId: payload.jobId, bidId: payload.bidId },
      }];
    }

    case "bid.accepted": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "bid_accepted",
        title: "¡Tu propuesta fue aceptada!",
        body: "El cliente aceptó tu propuesta. Coordina el inicio del proyecto.",
        payload: { jobId: payload.jobId, bidId: payload.bidId },
      }];
    }

    case "bid.rejected": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{
        userId: proUserId,
        type: "bid_rejected",
        title: "Propuesta no seleccionada",
        body: "El cliente eligió otra propuesta. Sigue aplicando a nuevos proyectos.",
        payload: { jobId: payload.jobId, bidId: payload.bidId },
      }];
    }

    // ── Change Orders ────────────────────────────────────────────────────────
    case "change-order:updated": {
      const specs: NotificationSpec[] = [];
      const status = extractStr(payload, "status");
      const clientUserId = extractStr(payload, "clientUserId");
      const proUserId = extractStr(payload, "proUserId");

      if (status === "submitted" && clientUserId) {
        specs.push({
          userId: clientUserId,
          type: "change_order_submitted",
          title: "Orden de cambio enviada",
          body: "El profesional propone un cambio en el alcance o costo del proyecto. Revisa y decide.",
          payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId },
        });
      } else if (status === "approved" && proUserId) {
        specs.push({
          userId: proUserId,
          type: "change_order_approved",
          title: "Orden de cambio aprobada",
          body: "El cliente aprobó la orden de cambio. Puedes proceder con el alcance actualizado.",
          payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId },
        });
      } else if (status === "rejected" && proUserId) {
        specs.push({
          userId: proUserId,
          type: "change_order_rejected",
          title: "Orden de cambio rechazada",
          body: "El cliente rechazó la orden de cambio. Revisa los comentarios y coordina.",
          payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId },
        });
      } else if (status === "changes_requested" && proUserId) {
        specs.push({
          userId: proUserId,
          type: "change_order_changes_requested",
          title: "Se requieren ajustes",
          body: "El cliente solicitó cambios en tu orden antes de aprobarla.",
          payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId },
        });
      }
      return specs;
    }

    // ── Job lifecycle ────────────────────────────────────────────────────────
    case "job.published": {
      // Broadcast to a system queue for matching — individual recipients handled by matching engine
      return [];
    }

    case "job.completed": {
      const proUserId = extractStr(payload, "proUserId");
      const clientUserId = extractStr(payload, "clientUserId");
      const specs: NotificationSpec[] = [];
      if (proUserId) {
        specs.push({
          userId: proUserId,
          type: "job_completed",
          title: "Trabajo marcado como completado",
          body: "El trabajo fue cerrado exitosamente. Revisa tu calificación y pago final.",
          payload: { jobId: payload.jobId },
        });
      }
      if (clientUserId) {
        specs.push({
          userId: clientUserId,
          type: "job_completed_client",
          title: "Proyecto completado",
          body: "Tu proyecto fue cerrado. Califica al profesional para fortalecer la plataforma.",
          payload: { jobId: payload.jobId },
        });
      }
      return specs;
    }

    // ── Payments ─────────────────────────────────────────────────────────────
    case "payment.refunded": {
      const clientUserId = extractStr(payload, "clientUserId");
      if (!clientUserId) return [];
      return [{
        userId: clientUserId,
        type: "payment_refunded",
        title: "Reembolso procesado",
        body: "Se procesó un reembolso a tu cuenta de escrow.",
        payload: { jobId: payload.jobId, amount: payload.amount },
      }];
    }

    // ── Smart Intake ─────────────────────────────────────────────────────────
    case "intake.converted": {
      const ownerUserId = extractStr(payload, "ownerUserId");
      if (!ownerUserId) return [];
      return [{
        userId: ownerUserId,
        type: "intake_converted",
        title: "Tu solicitud se convirtió en proyecto",
        body: "Prometeo procesó tu solicitud y creó un proyecto. Revisa los detalles.",
        payload: { jobId: payload.jobId, intakeId: payload.intakeId },
      }];
    }

    // ── Governance ────────────────────────────────────────────────────────────
    case "governance.proposal.closed": {
      const authorUserId = extractStr(payload, "authorUserId");
      if (!authorUserId) return [];
      return [{
        userId: authorUserId,
        type: "governance_proposal_closed",
        title: "Tu propuesta de gobernanza cerró",
        body: `La votación de tu propuesta terminó. Resultado: ${payload.result ?? "pendiente"}.`,
        payload: { proposalId: payload.proposalId },
      }];
    }

    default:
      return [];
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationsRepository,
    @Optional() private readonly communicationsOutbox?: CommunicationsOutboxService,
    @Optional() private readonly sse?: SseEventBusService,
  ) {}

  async listForUser(input: {
    tenantId: string;
    userId: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const [items, unread] = await Promise.all([
      this.repository.listForUser(input),
      this.repository.countUnread({ tenantId: input.tenantId, userId: input.userId }),
    ]);
    return { items, unread };
  }

  async markRead(input: { tenantId: string; userId: string; notificationId: string }) {
    return this.repository.markRead(input);
  }

  async markAllRead(input: { tenantId: string; userId: string }) {
    return this.repository.markAllRead(input);
  }

  /**
   * Called by DomainEventBus after an event is emitted.
   * Creates in-app notifications for the relevant recipients.
   * Failures are swallowed — notifications are best-effort.
   */
  async handleEvent(input: {
    tenantId: string;
    eventType: string;
    payload: NotificationEventPayload;
  }): Promise<void> {
    const specs = mapEventToNotifications(input.eventType, input.payload);
    if (specs.length === 0) return;

    for (const spec of specs) {
      try {
        const notification = await this.repository.create({
          tenantId: input.tenantId,
          userId: spec.userId,
          type: spec.type,
          title: spec.title,
          body: spec.body,
          payload: spec.payload,
        });

        // SSE: notify the recipient in real-time
        this.sse?.emit(`notifications:${input.tenantId}:${spec.userId}`, "notification:new", {
          id:    notification.id,
          type:  spec.type,
          title: spec.title,
          body:  spec.body,
          createdAt: new Date().toISOString(),
        });

        if (this.communicationsOutbox) {
          void this.communicationsOutbox.deliverNotification({
            tenantId: input.tenantId,
            notificationId: notification.id,
            userId: spec.userId,
            title: spec.title,
            body: spec.body,
            payload: {
              type: spec.type,
              ...(spec.payload ?? {}),
            },
          }).catch((error) => {
            this.logger.warn(
              { eventType: input.eventType, userId: spec.userId, notificationId: notification.id, error },
              "Failed to deliver WhatsApp notification — skipping",
            );
          });
        }
      } catch (error) {
        this.logger.warn(
          { eventType: input.eventType, userId: spec.userId, error },
          "Failed to create notification — skipping",
        );
      }
    }
  }
}
