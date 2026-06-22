// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { DailyLogService } from './daily-log.service.js';

/**
 * DailyLogScheduler — crear daily logs cada día a las 20:00 UTC.
 * Similar a LienAlertsScheduler pero para evidencia.
 */
@Injectable()
export class DailyLogScheduler {
  private readonly logger = new Logger(DailyLogScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyLogService: DailyLogService
  ) {}

  /**
   * Crear daily logs para todos los proyectos.
   * Ejecutar cada día a las 20:00 UTC.
   */
  async createDailyLogs(): Promise<{
    processed: number;
    created: number;
    failed: number;
  }> {
    this.logger.log(`Starting daily log creation job`);

    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
    });

    let created = 0;
    let failed = 0;

    // Fecha de ayer (para crear logs atrasados)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    for (const project of projects) {
      try {
        // Verificar que no exista log para ayer
        const existing = await this.prisma.evidenceLog.findFirst({
          where: {
            projectId: project.id,
            logDate: yesterday,
          },
        });

        if (existing) {
          this.logger.debug(`Log already exists: ${project.id} / ${yesterday.toISOString()}`);
          continue;
        }

        // Crear daily log
        await this.dailyLogService.createDailyLog(project.id, yesterday);
        created++;
      } catch (error) {
        this.logger.error(`Failed to create daily log for ${project.id}`, error);
        failed++;
      }
    }

    this.logger.log(`Daily log creation completed`, {
      processed: projects.length,
      created,
      failed,
    });

    return { processed: projects.length, created, failed };
  }

  /**
   * Resetear daily logs para testing.
   */
  async resetDailyLogsForTesting(projectId: string): Promise<void> {
    await this.prisma.evidenceLog.deleteMany({
      where: { projectId },
    });

    this.logger.debug(`Daily logs reset for testing: ${projectId}`);
  }
}
