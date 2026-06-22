import { Controller, Get, Param, UseGuards, Logger, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ExportBundleService } from './export-bundle.service.js';

/**
 * Export Controller — endpoints para descargar bundles.
 */
@Controller('v1/projects/:projectId/evidence')
@UseGuards(AuthGuard('jwt'))
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(private readonly exportBundleService: ExportBundleService) {}

  /**
   * GET /v1/projects/:projectId/evidence/export-bundle
   *
   * Descargar bundle PDF de evidencia.
   * Retorna archivo como attachment.
   */
  @Get('export-bundle')
  async exportBundle(
    @Param('projectId') projectId: string,
    @Res() res: Response
  ) {
    this.logger.log(`GET /export-bundle: ${projectId}`);

    try {
      // 1. Generar HTML bundle
      const html = await this.exportBundleService.generateBundle(projectId);

      // 2. Convertir a PDF (placeholder: por ahora HTML)
      const pdfBuffer = await this.exportBundleService.generatePDFBuffer(html);

      // 3. Retornar como descarga
      const filename = `evidence_bundle_${projectId}_${new Date().getTime()}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);

      this.logger.log(`Bundle downloaded: ${projectId}`, { filename });
    } catch (error) {
      this.logger.error(`Failed to export bundle`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate bundle',
        error: (error as Error).message,
      });
    }
  }

  /**
   * GET /v1/projects/:projectId/evidence/export-bundle/preview
   *
   * Obtener preview del bundle (HTML solo, sin PDF).
   */
  @Get('export-bundle/preview')
  async exportBundlePreview(
    @Param('projectId') projectId: string
  ) {
    this.logger.log(`GET /export-bundle/preview: ${projectId}`);

    const html = await this.exportBundleService.generateBundle(projectId);

    return {
      success: true,
      data: {
        html,
        projectId,
        generatedAt: new Date(),
      },
    };
  }
}
