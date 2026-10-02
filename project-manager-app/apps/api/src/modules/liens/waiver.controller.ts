import { Controller, Post, Get, Param, Body, Req, UseGuards, Logger, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedAccess } from '../../common/permissions.decorator.js';
import { resolveRequestContext } from '../../common/request-context.js';
import { LiensService } from './liens.service.js';
import { LienAccessService } from './lien-access.service.js';

/**
 * Waiver Controller — endpoints para firmar waivers.
 */
@Controller('v1/projects/:projectId/liens/waivers')
@UseGuards(AuthGuard('jwt'))
@AuthenticatedAccess('Legacy lien waiver endpoints are JWT-protected and pending granular lien permissions.')
export class WaiverController {
  private readonly logger = new Logger(WaiverController.name);

  constructor(
    private readonly liensService: LiensService,
    private readonly access: LienAccessService,
  ) {}

  /**
   * GET /v1/projects/:projectId/liens/waivers/:waiverId/sign-url
   *
   * Obtener URL de firma para waiver.
   */
  @Get(':waiverId/sign-url')
  async getSignUrl(
    @Req() req: { headers?: Record<string, unknown> },
    @Param('projectId') projectId: string,
    @Param('waiverId') waiverId: string,
  ) {
    this.logger.log(`GET /waivers/:waiverId/sign-url: ${waiverId}`);
    await this.access.assertWaiver(resolveRequestContext(req), projectId, waiverId, 'pro');

    const waiver = await this.liensService.getLienWaiver(waiverId);

    // Generar URL firmable (en producción: HelloSign/DocuSign)
    const signUrl = `https://semse.app/sign/waiver/${waiverId}?token=${Buffer.from(waiverId).toString('base64')}`;

    return {
      success: true,
      data: {
        waiverId,
        signUrl,
        deadline: waiver.requiredBefore,
        type: waiver.waiverType,
      },
    };
  }

  /**
   * POST /v1/projects/:projectId/liens/waivers/:waiverId/sign
   *
   * Firmar waiver (capturar firma digital).
   */
  @Post(':waiverId/sign')
  async signWaiver(
    @Req() req: { headers?: Record<string, unknown> },
    @Param('projectId') projectId: string,
    @Param('waiverId') waiverId: string,
    @Body() body: { signature: string }
  ) {
    this.logger.log(`POST /waivers/:waiverId/sign: ${waiverId}`);

    if (!body.signature) {
      throw new BadRequestException('signature is required');
    }

    const actor = resolveRequestContext(req);
    // Only the project's professional (or OPS_ADMIN) may sign, and the waiver
    // must belong to this project/tenant: signing clears the payment gate.
    await this.access.assertWaiver(actor, projectId, waiverId, 'pro');
    const signed = await this.liensService.signWaiver(waiverId, {
      signature: body.signature,
      signedBy: actor.userId,
    });

    return {
      success: true,
      message: 'Waiver signed successfully',
      data: signed,
    };
  }
}

/**
 * Métodos helper en LiensService (a agregar).
 */
export interface LienWaiver {
  id: string;
  waiverType: string;
  requiredBefore: Date;
  status: string;
}
