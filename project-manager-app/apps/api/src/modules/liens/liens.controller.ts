import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LiensService } from './liens.service.js';

/**
 * REST Controller para Liens — calendarios de preliminary notices.
 * Endpoints:
 * - POST   /v1/projects/:projectId/liens/calendar
 * - GET    /v1/projects/:projectId/liens/calendar
 * - GET    /v1/projects/:projectId/liens/waivers
 */
@Controller('v1/projects/:projectId/liens')
@UseGuards(AuthGuard('jwt'))
export class LiensController {
  private readonly logger = new Logger(LiensController.name);

  constructor(private readonly liensService: LiensService) {}

  /**
   * POST /v1/projects/:projectId/liens/calendar
   *
   * Crear un nuevo calendario de liens para un estado.
   * Consulta LienGrid API automáticamente.
   */
  @Post('calendar')
  async createLienCalendar(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      stateName: string;
      projectStartDate: string; // ISO 8601
    }
  ) {
    this.logger.log(`POST /liens/calendar: ${projectId} / ${body.stateName}`);

    if (!body.stateName) {
      throw new BadRequestException('stateName is required');
    }

    if (!body.projectStartDate) {
      throw new BadRequestException('projectStartDate is required');
    }

    try {
      const calendar = await this.liensService.createLienCalendar(
        projectId,
        body.stateName,
        new Date(body.projectStartDate)
      );

      return {
        success: true,
        data: calendar,
      };
    } catch (error) {
      this.logger.error(`Failed to create lien calendar`, error);
      throw error;
    }
  }

  /**
   * GET /v1/projects/:projectId/liens/calendar
   *
   * Obtener todos los calendarios de liens para un proyecto.
   */
  @Get('calendar')
  async getLienCalendars(@Param('projectId') projectId: string) {
    this.logger.log(`GET /liens/calendar: ${projectId}`);

    try {
      const calendars = await this.liensService.getLienCalendars(projectId);

      return {
        success: true,
        count: calendars.length,
        data: calendars,
      };
    } catch (error) {
      this.logger.error(`Failed to get lien calendars`, error);
      throw error;
    }
  }

  /**
   * GET /v1/projects/:projectId/liens/waivers
   *
   * Obtener waivers pendientes para un proyecto.
   * Usado por Payment FSM para verificar gate.
   */
  @Get('waivers')
  async getLienWaivers(@Param('projectId') projectId: string) {
    this.logger.log(`GET /liens/waivers: ${projectId}`);

    try {
      const waivers = await this.liensService.getLienWaivers(projectId);

      return {
        success: true,
        count: waivers.length,
        data: waivers.map((w) => ({
          id: w.id,
          lienCalendarId: w.lienCalendarId,
          stateName: w.lienCalendar?.stateName,
          waiverType: w.waiverType,
          releaseAmount: w.releaseAmount,
          requiredBefore: w.requiredBefore,
          status: w.status,
          signingUrl: w.signingUrl,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get lien waivers`, error);
      throw error;
    }
  }

  /**
   * POST /v1/projects/:projectId/liens/calendar/:lienCalendarId/status
   *
   * Actualizar estado del calendario (cambio de deadline).
   * Uso interno por scheduler.
   */
  @Post('calendar/:lienCalendarId/status')
  async updateCalendarStatus(
    @Param('projectId') projectId: string,
    @Param('lienCalendarId') lienCalendarId: string,
    @Body() body: { newStatus: string }
  ) {
    this.logger.log(`POST /liens/calendar/:lienCalendarId/status: ${lienCalendarId}`);

    if (!body.newStatus) {
      throw new BadRequestException('newStatus is required');
    }

    try {
      const updated = await this.liensService.updateCalendarStatus(
        lienCalendarId,
        body.newStatus
      );

      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      this.logger.error(`Failed to update calendar status`, error);
      throw error;
    }
  }

  /**
   * POST /v1/projects/:projectId/liens/waivers/:waiverId/sign
   *
   * Firmar un waiver (capturar firma digital).
   */
  @Post('waivers/:waiverId/sign')
  async signWaiver(
    @Param('projectId') projectId: string,
    @Param('waiverId') waiverId: string,
    @Body() body: { signature: string }
  ) {
    this.logger.log(`POST /liens/waivers/:waiverId/sign: ${waiverId}`);

    if (!body.signature) {
      throw new BadRequestException('signature is required');
    }

    try {
      const signed = await this.liensService.signWaiver(waiverId, {
        signature: body.signature,
        signedBy: 'user-id-from-context', // TODO: obtener del JWT
      });

      return {
        success: true,
        data: signed,
      };
    } catch (error) {
      this.logger.error(`Failed to sign waiver`, error);
      throw error;
    }
  }
}
