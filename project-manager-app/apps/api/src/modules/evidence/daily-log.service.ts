import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';

/**
 * DailyLogService — crear daily logs automáticamente con firma digital.
 * Ejecutado cada día a las 20:00 UTC por scheduler.
 */

export interface DailyLogSummary {
  date: string; // YYYY-MM-DD
  photoCount: number;
  changesCount: number;
  eventsLog: string[];
  signatures: Array<{ user: string; signedAt: Date }>;
}

@Injectable()
export class DailyLogService {
  private readonly logger = new Logger(DailyLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear daily log para un proyecto en una fecha.
   */
  async createDailyLog(projectId: string, date: Date): Promise<any> {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    this.logger.log(`Creating daily log: ${projectId} / ${dateStr}`);

    // 1. Contar fotos del día
    const photos = await this.prisma.evidencePhoto.findMany({
      where: {
        projectId,
        exifTimestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // 2. Contar cambios del día (cambios en proyecto, payments, etc)
    // TODO: obtener de audit log
    const changesCount = 0;

    // 3. Crear evento log
    const eventsLog: string[] = [];
    eventsLog.push(`Daily log auto-created for ${dateStr}`);
    eventsLog.push(`Photos: ${photos.length}`);
    if (changesCount > 0) {
      eventsLog.push(`Changes: ${changesCount}`);
    }

    // 4. Crear registro en BD
    const dailyLog = await this.prisma.evidenceLog.create({
      data: {
        projectId,
        logDate: new Date(dateStr),
        photoCount: photos.length,
        changesCount,
        eventsLog: JSON.stringify(eventsLog),
        status: 'DRAFT',
        createdBy: 'system',
      },
    });

    this.logger.log(`Daily log created: ${dailyLog.id}`, {
      projectId,
      dateStr,
      photoCount: photos.length,
    });

    return dailyLog;
  }

  /**
   * Obtener daily logs de un proyecto en un rango de fechas.
   */
  async getDailyLogs(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    const where: any = { projectId };

    if (startDate || endDate) {
      where.logDate = {};
      if (startDate) where.logDate.gte = startDate;
      if (endDate) where.logDate.lte = endDate;
    }

    return await this.prisma.evidenceLog.findMany({
      where,
      orderBy: { logDate: 'desc' },
    });
  }

  /**
   * Firmar daily log.
   * Transición: DRAFT → SIGNED
   */
  async signDailyLog(logId: string, userId: string, signature: string): Promise<any> {
    this.logger.log(`Signing daily log: ${logId}`);

    const log = await this.prisma.evidenceLog.findUniqueOrThrow({
      where: { id: logId },
    });

    if (log.status !== 'DRAFT') {
      throw new Error(`Cannot sign log with status ${log.status}`);
    }

    // Guardar firma en BD
    const signedLog = await this.prisma.evidenceLog.update({
      where: { id: logId },
      data: {
        status: 'SIGNED',
        signedBy: userId,
        signedAt: new Date(),
        signature, // base64 o URL
      },
    });

    this.logger.log(`Daily log signed: ${logId}`, {
      signedBy: userId,
    });

    return signedLog;
  }

  /**
   * Obtener resumen de daily log.
   */
  async getDailyLogSummary(logId: string): Promise<DailyLogSummary> {
    const log = await this.prisma.evidenceLog.findUniqueOrThrow({
      where: { id: logId },
    });

    const eventsLog = log.eventsLog ? JSON.parse(log.eventsLog) : [];
    const signatures = log.signedAt
      ? [{ user: log.signedBy || 'unknown', signedAt: log.signedAt }]
      : [];

    return {
      date: log.logDate.toISOString().split('T')[0],
      photoCount: log.photoCount,
      changesCount: log.changesCount,
      eventsLog,
      signatures,
    };
  }

  /**
   * Validar que se creó daily log para cada día.
   * Útil para auditoría.
   */
  async getLogCoverage(projectId: string): Promise<{
    totalDays: number;
    logsCreated: number;
    logsSignedCount: number;
    coverage: number; // porcentaje
  }> {
    const logs = await this.prisma.evidenceLog.findMany({
      where: { projectId },
    });

    // Calcular días totales desde project start
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    const startDate = project.startDate || new Date();
    const today = new Date();
    const totalDays = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const signedLogs = logs.filter((l) => l.status === 'SIGNED').length;
    const coverage = totalDays > 0 ? (logs.length / totalDays) * 100 : 0;

    return {
      totalDays,
      logsCreated: logs.length,
      logsSignedCount: signedLogs,
      coverage: Math.round(coverage),
    };
  }
}
