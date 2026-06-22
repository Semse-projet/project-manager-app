import { Controller, Post, Get, Param, Body, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LiensService } from './liens.service';

/**
 * Waiver Controller — endpoints para firmar waivers.
 */
@Controller('v1/projects/:projectId/liens/waivers')
@UseGuards(AuthGuard('jwt'))
export class WaiverController {
  private readonly logger = new Logger(WaiverController.name);

  constructor(private readonly liensService: LiensService) {}

  /**
   * GET /v1/projects/:projectId/liens/waivers/:waiverId/sign-url
   *
   * Obtener URL de firma para waiver.
   */
  @Get(':waiverId/sign-url')
  async getSignUrl(@Param('projectId') projectId: string, @Param('waiverId') waiverId: string) {
    this.logger.log(`GET /waivers/:waiverId/sign-url: ${waiverId}`);

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
    @Param('projectId') projectId: string,
    @Param('waiverId') waiverId: string,
    @Body() body: { signature: string }
  ) {
    this.logger.log(`POST /waivers/:waiverId/sign: ${waiverId}`);

    const signed = await this.liensService.signWaiver(waiverId, {
      signature: body.signature,
      signedBy: 'user-from-jwt-context', // TODO: obtener del token
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
