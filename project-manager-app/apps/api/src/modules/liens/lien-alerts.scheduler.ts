// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LiensService } from './liens.service.js';
import { NoticeGeneratorService } from './notice-generator.service.js';

/**
 * LienAlertsScheduler — ejecuta jobs periódicos para alertas de lien deadlines.
 * Debe ser ejecutado cada hora por BullMQ o similar.
 *
 * Búsqueda: LienCalendars donde el deadline está en 30d, 7d, 3d, 1d
 * Transición: CREATED → ALERTED_30D → ALERTED_7D → ALERTED_3D
 * Notificación: push + email al PRO
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
    private readonly noticeGeneratorService: NoticeGeneratorService
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
      const calendars = await this.prisma.lienCalendar.findMany({
        where: {
          status: {
            in: ['CREATED', 'ALERTED_30D', 'ALERTED_7D', 'ALERTED_3D'],
          },
        },
        include: {
          project: {
            select: { id: true, tenantId: true, name: true, address: true },
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
              projectName: calendar.project.name,
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

            // TODO: Enviar notificación (push + email)
            // await this.notificationService.send({
            //   type: 'LIEN_DEADLINE_ALERT',
            //   projectId: calendar.projectId,
            //   data: { daysToDeadline, newStatus }
            // });
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
