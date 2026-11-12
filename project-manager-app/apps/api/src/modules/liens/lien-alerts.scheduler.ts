import { Injectable, Logger, Optional } from '@nestjs/common';
import { EmailService } from '../../infrastructure/email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LiensService } from './liens.service.js';
import { NoticeGeneratorService } from './notice-generator.service.js';

/**
 * LienAlertsScheduler — ejecuta jobs periódicos para alertas de lien deadlines.
 * Disparado cada hora por apps/worker/src/main.mjs (runLienDeadlineCheckSafe,
 * kill switch LIEN_ALERTS_ENABLED, 2026-08-27) vía
 * POST /v1/admin/liens/check-deadlines — antes solo existía el trigger manual.
 *
 * Búsqueda: LienCalendars donde el deadline está en 30d, 7d, 3d, 1d
 * Transición: CREATED → ALERTED_30D → ALERTED_7D → ALERTED_3D
 * Notificación (decisión D-LIEN del dueño, 2026-11-11): en cada transición se
 *   avisa a TODOS los miembros ACTIVOS con rol PRO de la organización asignada
 *   al proyecto (Project.assignedProOrgId, dentro del tenant del proyecto) —
 *   in-app + push (+ WhatsApp si está habilitado) vía NotificationsService, y
 *   email vía EmailService. Best-effort: un fallo de envío no revierte la
 *   transición ni bloquea los demás calendarios; queda en el log.
 * Generación: notices automáticos cuando ALERTED_3D se alcanza
 */
@Injectable()
export class LienAlertsScheduler {
  private readonly logger = new Logger(LienAlertsScheduler.name);

  // Milisegundos por días
  private readonly MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly liensService: LiensService,
    private readonly noticeGeneratorService: NoticeGeneratorService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly email?: EmailService,
  ) {}

  /**
   * Ejecutar chequeo de deadlines (debe ser llamado cada hora).
   * Verifica si algún LienCalendar pasó un threshold y actualiza estado.
   */
  async checkAndAlertDeadlines(): Promise<void> {
    this.logger.log('Starting check-lien-deadlines job');

    const now = new Date();
    let alertsCount = 0;

    try {
      // 1. Buscar calendarios en estado CREATED (aún no alertados)
      // Project has no name/address fields (checked against
      // packages/db/prisma/schema.prisma 2026-08-27; the old
      // `select: { name: true, address: true }` here referenced fields
      // that don't exist on Project and would make Prisma reject this
      // query outright — the project's display name/location live on its
      // parent Job).
      const calendars = await this.prisma.lienCalendar.findMany({
        where: {
          status: {
            in: ['CREATED', 'ALERTED_30D', 'ALERTED_7D', 'ALERTED_3D'],
          },
        },
        include: {
          project: {
            select: { id: true, tenantId: true, assignedProOrgId: true, job: { select: { title: true } } },
          },
        },
      });

      this.logger.log(`Checking ${calendars.length} lien calendars`);

      for (const calendar of calendars) {
        const daysToDeadline = this.daysUntil(now, calendar.preliminaryNoticeDeadline);

        let newStatus: string | null = null;

        // Determinar si necesita transición
        if (calendar.status === 'CREATED' && daysToDeadline <= 30) {
          newStatus = 'ALERTED_30D';
        } else if (calendar.status === 'ALERTED_30D' && daysToDeadline <= 7) {
          newStatus = 'ALERTED_7D';
        } else if (calendar.status === 'ALERTED_7D' && daysToDeadline <= 3) {
          newStatus = 'ALERTED_3D';
        }

        // Si transición necesaria
        if (newStatus) {
          try {
            await this.liensService.updateCalendarStatus(calendar.id, newStatus);
            alertsCount++;

            this.logger.log(`Updated calendar to ${newStatus}`, {
              calendarId: calendar.id,
              projectName: calendar.project.job.title,
              daysToDeadline,
            });

            // Generar notices automáticamente cuando se alcanza ALERTED_3D
            if (newStatus === 'ALERTED_3D') {
              try {
                const notices = await this.noticeGeneratorService.generateAllNoticesForCalendar(
                  calendar.id,
                  'system' // createdBy: sistema automático
                );
                this.logger.log(`Generated ${notices.length} notices for calendar ${calendar.id}`);
              } catch (noticeError) {
                this.logger.error(
                  `Failed to generate notices for ${calendar.id}`,
                  noticeError
                );
                // No bloquear si falla la generación de notices
              }
            }

            await this.notifyDeadlineAlert({
              calendarId: calendar.id,
              projectId: calendar.project.id,
              tenantId: calendar.project.tenantId,
              assignedProOrgId: calendar.project.assignedProOrgId,
              projectTitle: calendar.project.job.title,
              stateName: calendar.stateName,
              deadline: calendar.preliminaryNoticeDeadline,
              daysToDeadline,
              newStatus,
            });
          } catch (error) {
            this.logger.error(`Failed to update calendar ${calendar.id}`, error);
            // Continue con otros calendarios
          }
        }
      }

      this.logger.log(`Lien deadlines check completed`, {
        totalChecked: calendars.length,
        alertsTriggered: alertsCount,
      });
    } catch (error) {
      this.logger.error('check-lien-deadlines job failed', error);
      throw error; // Propagar para que BullMQ reintente
    }
  }

  /**
   * D-LIEN: avisa a los miembros PRO activos de la organización asignada. Nunca lanza: el aviso es best-effort
   * y la transición de estado ya quedó confirmada.
   */
  private async notifyDeadlineAlert(input: {
    calendarId: string;
    projectId: string;
    tenantId: string;
    assignedProOrgId: string;
    projectTitle: string;
    stateName: string;
    deadline: Date;
    daysToDeadline: number;
    newStatus: string;
  }): Promise<void> {
    try {
      const memberships = await this.prisma.membership.findMany({
        where: {
          orgId: input.assignedProOrgId,
          status: 'ACTIVE',
          role: { key: 'PRO' },
          org: { tenantId: input.tenantId },
          user: { status: 'active' },
        },
        select: { userId: true, user: { select: { email: true } } },
      });
      const recipients = new Map<string, string | null>();
      for (const m of memberships) recipients.set(m.userId, m.user?.email ?? null);

      if (recipients.size === 0) {
        this.logger.warn(`Lien deadline alert has no recipient (no ACTIVE PRO member)`, {
          calendarId: input.calendarId,
          projectId: input.projectId,
        });
        return;
      }

      const days = Math.max(0, input.daysToDeadline);
      const deadlineDate = input.deadline.toISOString().slice(0, 10);
      const final = input.newStatus === 'ALERTED_3D';
      const title = final
        ? `Último aviso: plazo de lien en ${days} día(s)`
        : `Plazo de lien en ${days} día(s)`;
      const body =
        `El plazo del aviso preliminar de lien (${input.stateName}) del proyecto "${input.projectTitle}" vence el ${deadlineDate}.` +
        (final ? ' Los avisos ya se generaron: revísalos y envíalos antes del plazo.' : ' Revisa el calendario de liens del proyecto.');

      let created = 0;
      if (this.notifications) {
        ({ created } = await this.notifications.notifyUsers({
          tenantId: input.tenantId,
          userIds: [...recipients.keys()],
          type: 'lien_deadline_alert',
          title,
          body,
          payload: {
            lienCalendarId: input.calendarId,
            projectId: input.projectId,
            status: input.newStatus,
            daysToDeadline: days,
            deadline: deadlineDate,
          },
        }));
      }

      let emailsSent = 0;
      if (this.email) {
        for (const address of new Set([...recipients.values()].filter((e): e is string => Boolean(e)))) {
          const result = await this.email.send({ to: address, subject: `SEMSE — ${title}`, html: `<p>${escapeHtml(body)}</p>`, text: body });
          if (result.sent) emailsSent += 1;
        }
      }

      this.logger.log(`Lien deadline alert delivered`, {
        calendarId: input.calendarId,
        status: input.newStatus,
        recipients: recipients.size,
        notificationsCreated: created,
        emailsSent,
      });
    } catch (error) {
      this.logger.error(`Failed to deliver lien deadline alert for ${input.calendarId}`, error);
    }
  }

  /**
   * Calcular días entre dos fechas.
   * Retorna número positivo si deadline está en el futuro.
   */
  private daysUntil(from: Date, to: Date): number {
    const diff = to.getTime() - from.getTime();
    return Math.ceil(diff / this.MILLISECONDS_PER_DAY);
  }

  /**
   * Job manual para resetear alertas (para testing).
   * Retorna todos los calendarios a CREATED.
   */
  async resetAlertsForTesting(): Promise<number> {
    const result = await this.prisma.lienCalendar.updateMany({
      where: {
        status: {
          in: ['ALERTED_30D', 'ALERTED_7D', 'ALERTED_3D'],
        },
      },
      data: { status: 'CREATED' },
    });

    this.logger.warn(`Reset ${result.count} calendars to CREATED for testing`);
    return result.count;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
