import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedAccess } from '../../common/permissions.decorator.js';
import { resolveRequestContext } from '../../common/request-context.js';
import { NoticeGeneratorService } from './notice-generator.service.js';
import { NoticeSendService } from './notice-send.service.js';
import { LiensService } from './liens.service.js';

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
@AuthenticatedAccess('Legacy lien notice endpoints are JWT-protected and pending granular lien permissions.')
export class NoticeController {
  private readonly logger = new Logger(NoticeController.name);

  constructor(
    private readonly noticeGeneratorService: NoticeGeneratorService,
    private readonly noticeSendService: NoticeSendService,
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
    @Req() req: { headers?: Record<string, unknown> },
    @Param('projectId') projectId: string,
    @Param('calendarId') calendarId: string,
    @Body() body: { recipientType?: 'owner' | 'general_contractor' | 'lender' | 'architect' }
  ) {
    this.logger.log(`POST /generate-notice: ${calendarId}`);

    const actor = resolveRequestContext(req);

    try {
      // Si no especifica recipientType, generar todos
      if (body.recipientType) {
        const notice = await this.noticeGeneratorService.generateNoticeFromCalendar(
          calendarId,
          body.recipientType,
          actor.userId
        );

        return {
          success: true,
          data: notice,
        };
      } else {
        // Generar todos los notices
        const notices = await this.noticeGeneratorService.generateAllNoticesForCalendar(
          calendarId,
          actor.userId
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
      // getLienCalendars() already includes each calendar's non-DRAFT
      // notices (see LiensService.getLienCalendars) — this endpoint used to
      // discard that and return a hardcoded empty array instead (found
      // 2026-08-27 while wiring this module into AppModule; every call to
      // GET /notices always reported zero notices regardless of what was in
      // the DB). Flatten what was already fetched instead of re-querying.
      const calendars = await this.liensService.getLienCalendars(projectId);
      const allNotices = calendars.flatMap((calendar: any) => calendar.notices ?? []);

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
   * Enviar notice vía Lob.com (correo certificado), transición
   * DRAFT → NOTICE_SENT.
   *
   * Antes (hasta 2026-08-27) este endpoint llamaba directamente a
   * NoticeGeneratorService.updateNoticeStatus(), que solo cambia el campo
   * `status` en la fila — nunca invocaba a NoticeSendService (el único
   * código de este módulo que realmente llama a Lob.com) ni fallaba si la
   * dirección del proyecto era inválida. Un caller de este endpoint recibía
   * "Notice marked as sent" con un aviso legal que en realidad nunca se
   * envió por correo. Corregido para delegar en NoticeSendService.sendNotice(),
   * que sí falla (fail-closed) si la dirección no es parseable.
   */
  @Post('notices/:noticeId/send')
  async sendNotice(
    @Param('projectId') projectId: string,
    @Param('noticeId') noticeId: string
  ) {
    this.logger.log(`POST /notices/:noticeId/send: ${noticeId}`);

    try {
      const updated = await this.noticeSendService.sendNotice(noticeId);

      return {
        success: true,
        message: 'Notice sent via certified mail (Lob.com)',
        data: updated,
      };
    } catch (error) {
      this.logger.error(`Failed to send notice`, error);
      throw error;
    }
  }
}
