// @ts-nocheck
import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LienGridClient, LienGridDeadlines } from '../../integrations/liengrid.js';

/**
 * LiensService — gestión de calendarios de liens, deadlines y waivers.
 * Integración con LienGrid API para 50 estados US.
 */
@Injectable()
export class LiensService {
  private readonly logger = new Logger(LiensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly liengridClient: LienGridClient
  ) {}

  /**
   * Crear un nuevo calendario de liens para un proyecto en un estado.
   * Consulta LienGrid API y guarda deadlines.
   */
  async createLienCalendar(
    projectId: string,
    stateName: string,
    projectStartDate: Date
  ): Promise<any> {
    this.logger.log(`Creating lien calendar: ${projectId} / ${stateName}`);

    // 1. Verificar que el proyecto existe
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, address: true, tenantId: true },
    });

    // 2. Verificar que no existe ya un calendar para esta combinación
    const existing = await this.prisma.lienCalendar.findUnique({
      where: {
        projectId_stateName: { projectId, stateName },
      },
    });

    if (existing) {
      this.logger.warn(`Lien calendar already exists: ${projectId} / ${stateName}`);
      return existing;
    }

    // 3. Consultar LienGrid API
    let deadlines: LienGridDeadlines;
    try {
      deadlines = await this.liengridClient.getDeadlines({
        address: project.address || 'Unknown',
        state: stateName,
        projectStartDate: projectStartDate.toISOString(),
        apiKey: process.env.LIENGRID_API_KEY || '',
      });
    } catch (error) {
      this.logger.error(`LienGrid API failed: ${stateName}`, error);
      throw new InternalServerErrorException(`Failed to fetch lien deadlines for ${stateName}`);
    }

    // 4. Crear LienCalendar en BD
    const calendar = await this.prisma.lienCalendar.create({
      data: {
        projectId,
        stateName,
        preliminaryNoticeDeadline: new Date(deadlines.preliminaryNoticeDeadline),
        waiverDeadline: new Date(deadlines.waiverDeadline),
        finalNoticeDeadline: deadlines.finalNoticeDeadline
          ? new Date(deadlines.finalNoticeDeadline)
          : null,
        statusLienDeadline: deadlines.statusLienDeadline
          ? new Date(deadlines.statusLienDeadline)
          : null,
        requiresNotary: deadlines.requiresNotary,
        requiresCertifiedMail: deadlines.requiresCertifiedMail,
        status: 'CREATED',
        liengridResponseJson: deadlines,
        lastFetchedAt: new Date(),
      },
    });

    this.logger.log(`Lien calendar created: ${calendar.id}`, {
      projectId,
      stateName,
      deadline: calendar.preliminaryNoticeDeadline,
    });

    return calendar;
  }

  /**
   * Obtener todos los calendarios de liens para un proyecto.
   */
  async getLienCalendars(projectId: string): Promise<any[]> {
    return await this.prisma.lienCalendar.findMany({
      where: { projectId },
      orderBy: { preliminaryNoticeDeadline: 'asc' },
      include: {
        notices: { where: { status: { not: 'DRAFT' } } },
        waivers: { where: { status: 'PENDING' } },
      },
    });
  }

  /**
   * Obtener un calendario específico.
   */
  async getLienCalendar(lienCalendarId: string): Promise<any> {
    return await this.prisma.lienCalendar.findUniqueOrThrow({
      where: { id: lienCalendarId },
      include: {
        notices: true,
        waivers: true,
      },
    });
  }

  /**
   * Obtener waivers pendientes para un proyecto.
   * Usado por PaymentGovernanceService para gate release.
   */
  async getLienWaivers(projectId: string): Promise<any[]> {
    return await this.prisma.lienWaiver.findMany({
      where: {
        lienCalendar: { projectId },
        status: 'PENDING',
      },
      include: {
        lienCalendar: true,
      },
      orderBy: { requiredBefore: 'asc' },
    });
  }

  /**
   * Transición de estado: LienCalendar se acerca a deadline.
   * Llamado por scheduler (ej: BullMQ job).
   */
  async updateCalendarStatus(lienCalendarId: string, newStatus: string): Promise<any> {
    const validTransitions: Record<string, string[]> = {
      CREATED: ['ALERTED_30D'],
      ALERTED_30D: ['ALERTED_7D'],
      ALERTED_7D: ['ALERTED_3D'],
      ALERTED_3D: ['NOTICE_SENT'],
      NOTICE_SENT: ['NOTICE_DELIVERED', 'DELIVERY_FAILED'],
    };

    const calendar = await this.prisma.lienCalendar.findUniqueOrThrow({
      where: { id: lienCalendarId },
    });

    const allowed = validTransitions[calendar.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid transition: ${calendar.status} → ${newStatus}`
      );
    }

    return await this.prisma.lienCalendar.update({
      where: { id: lienCalendarId },
      data: { status: newStatus, updatedAt: new Date() },
    });
  }

  /**
   * Crear una notice (preliminar, final, etc.) en status DRAFT.
   */
  async createNotice(
    lienCalendarId: string,
    data: {
      noticeType: string;
      recipientType: string;
      noticeContent: string;
      createdBy: string;
    }
  ): Promise<any> {
    const _calendar = await this.prisma.lienCalendar.findUniqueOrThrow({
      where: { id: lienCalendarId },
    });

    return await this.prisma.lienNotice.create({
      data: {
        lienCalendarId,
        noticeType: data.noticeType,
        recipientType: data.recipientType,
        noticeContent: data.noticeContent,
        generatedAt: new Date(),
        createdBy: data.createdBy,
        status: 'DRAFT',
      },
    });
  }

  /**
   * Crear un waiver (condicional o incondicional).
   * Requerido antes de liberar escrow.
   */
  async createWaiver(
    lienCalendarId: string,
    data: {
      waiverType: 'conditional' | 'unconditional';
      releaseAmount?: number;
      escrowId?: string;
      milestoneId?: string;
      requiredBefore: Date;
    }
  ): Promise<any> {
    return await this.prisma.lienWaiver.create({
      data: {
        lienCalendarId,
        waiverType: data.waiverType,
        releaseAmount: data.releaseAmount ? BigInt(Math.floor(data.releaseAmount * 100)) : null,
        escrowId: data.escrowId,
        milestoneId: data.milestoneId,
        requiredBefore: data.requiredBefore,
        status: 'PENDING',
      },
    });
  }

  /**
   * Firmar un waiver (capturar firma digital).
   */
  async signWaiver(
    waiverId: string,
    data: {
      signature: string; // Base64 encoded
      signedBy: string; // User ID
    }
  ): Promise<any> {
    const waiver = await this.prisma.lienWaiver.findUniqueOrThrow({
      where: { id: waiverId },
    });

    if (waiver.status !== 'PENDING') {
      throw new BadRequestException(`Cannot sign waiver with status ${waiver.status}`);
    }

    return await this.prisma.lienWaiver.update({
      where: { id: waiverId },
      data: {
        signature: data.signature,
        signedBy: data.signedBy,
        signedAt: new Date(),
        status: 'SIGNED',
      },
    });
  }

  /**
   * Verificar si hay waivers sin firmar que bloquean release.
   * Llamado por PaymentGovernanceService.
   */
  async checkWaiverRequirements(
    projectId: string,
    releaseAmount: number
  ): Promise<{ canRelease: boolean; blockingWaivers: any[] }> {
    const blockingWaivers = await this.prisma.lienWaiver.findMany({
      where: {
        lienCalendar: { projectId },
        status: 'PENDING',
        // Condicionales que cubren este monto
        waiverType: 'conditional',
        releaseAmount: {
          gte: releaseAmount,
        },
      },
    });

    return {
      canRelease: blockingWaivers.length === 0,
      blockingWaivers,
    };
  }
}
