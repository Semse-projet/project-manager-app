import { Injectable, Logger } from "@nestjs/common";
import { NotificationsRepository } from "./notifications.repository.js";

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

    default:
      return [];
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repository: NotificationsRepository) {}

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
        await this.repository.create({
          tenantId: input.tenantId,
          userId: spec.userId,
          type: spec.type,
          title: spec.title,
          body: spec.body,
          payload: spec.payload,
        });
      } catch (error) {
        this.logger.warn(
          { eventType: input.eventType, userId: spec.userId, error },
          "Failed to create notification — skipping",
        );
      }
    }
  }
}
