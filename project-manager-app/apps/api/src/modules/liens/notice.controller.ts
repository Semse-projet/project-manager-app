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
import { NoticeGeneratorService } from './notice-generator.service';
import { LiensService } from './liens.service';

/**
 * Notice Controller — endpoints para generar y gestionar notices.
 *
 * Endpoints:
 * - POST /v1/projects/:projectId/liens/calendar/:calendarId/generate-notice
 * - GET /v1/projects/:projectId/liens/notices
 * - GET /v1/projects/:projectId/liens/notices/:noticeId/preview
 */
@Controller('v1/projects/:projectId/liens')
@UseGuards(AuthGuard('jwt'))
export class NoticeController {
  private readonly logger = new Logger(NoticeController.name);

  constructor(
    private readonly noticeGeneratorService: NoticeGeneratorService,
    private readonly liensService: LiensService
  ) {}

  /**
   * POST /v1/projects/:projectId/liens/calendar/:calendarId/generate-notice
   *
   * Generar notices para un calendario específico.
   * Genera DRAFT notices listos para envío.
   */
  @Post('calendar/:calendarId/generate-notice')
  async generateNotice(
    @Param('projectId') projectId: string,
    @Param('calendarId') calendarId: string,
    @Body() body: { recipientType?: 'owner' | 'general_contractor' | 'lender' | 'architect' }
  ) {
    this.logger.log(`POST /generate-notice: ${calendarId}`);

    try {
      // Si no especifica recipientType, generar todos
      if (body.recipientType) {
        const notice = await this.noticeGeneratorService.generateNoticeFromCalendar(
          calendarId,
          body.recipientType,
          'user-from-context' // TODO: obtener del JWT
        );

        return {
          success: true,
          data: notice,
        };
      } else {
        // Generar todos los notices
        const notices = await this.noticeGeneratorService.generateAllNoticesForCalendar(
          calendarId,
          'user-from-context' // TODO: obtener del JWT
        );

        return {
          success: true,
          count: notices.length,
          data: notices,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to generate notice`, error);
      throw error;
    }
  }

  /**
   * GET /v1/projects/:projectId/liens/notices
   *
   * Obtener todos los notices de un proyecto.
   */
  @Get('notices')
  async getNotices(
    @Param('projectId') projectId: string
  ) {
    this.logger.log(`GET /notices: ${projectId}`);

    try {
      // Obtener todos los calendarios del proyecto
      const calendars = await this.liensService.getLienCalendars(projectId);

      // Obtener todos los notices de esos calendarios
      const allNotices: any[] = [];

      for (const calendar of calendars) {
        const notices = await Promise.resolve(
          // En BD: SELECT * FROM LienNotice WHERE lienCalendarId = calendar.id
          []
        );
        allNotices.push(...notices);
      }

      return {
        success: true,
        count: allNotices.length,
        data: allNotices,
      };
    } catch (error) {
      this.logger.error(`Failed to get notices`, error);
      throw error;
    }
  }

  /**
   * GET /v1/projects/:projectId/liens/notices/:noticeId/preview
   *
   * Obtener preview de un notice (HTML para visualización).
   * Useful antes de envío (Bloque W: Lob.com integration).
   */
  @Get('notices/:noticeId/preview')
  async getNoticePreview(
    @Param('projectId') projectId: string,
    @Param('noticeId') noticeId: string
  ) {
    this.logger.log(`GET /notices/:noticeId/preview: ${noticeId}`);

    try {
      const preview = await this.noticeGeneratorService.getNoticePreview(noticeId);

      return {
        success: true,
        data: preview,
      };
    } catch (error) {
      this.logger.error(`Failed to get notice preview`, error);
      throw error;
    }
  }

  /**
   * POST /v1/projects/:projectId/liens/notices/:noticeId/send
   *
   * Enviar notice (transición DRAFT → NOTICE_SENT).
   * Próximo bloque: integración con Lob.com para envío real.
   */
  @Post('notices/:noticeId/send')
  async sendNotice(
    @Param('projectId') projectId: string,
    @Param('noticeId') noticeId: string
  ) {
    this.logger.log(`POST /notices/:noticeId/send: ${noticeId}`);

    try {
      // Transición de estado
      const updated = await this.noticeGeneratorService.updateNoticeStatus(
        noticeId,
        'NOTICE_SENT'
      );

      return {
        success: true,
        message: 'Notice marked as sent (Lob integration in Bloque W)',
        data: updated,
      };
    } catch (error) {
      this.logger.error(`Failed to send notice`, error);
      throw error;
    }
  }
}
