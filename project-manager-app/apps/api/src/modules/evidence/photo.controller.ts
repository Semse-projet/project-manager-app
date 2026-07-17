// @ts-nocheck
import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../common/permissions.decorator.js';
import { resolveRequestContext } from '../../common/request-context.js';
import {EXIFParser} from '../../integrations/exif-parser.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Photo Controller — upload de fotos con validación EXIF.
 * POST /v1/projects/:projectId/evidence/photos
 */
@Controller('v1/projects/:projectId/evidence')
@UseGuards(AuthGuard('jwt'))
@RequirePermissions('evidence:read')
export class PhotoController {
  private readonly logger = new Logger(PhotoController.name);
  private readonly exifParser = new EXIFParser();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * POST /v1/projects/:projectId/evidence/photos
   *
   * Upload foto con validación EXIF.
   * Requiere: DateTimeOriginal + GPS coordinates
   */
  @Post('photos')
  @RequirePermissions('evidence:write')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(
    @Req() req: { headers?: Record<string, unknown> },
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    this.logger.log(`POST /photos: ${projectId}`);

    const actor = resolveRequestContext(req);

    if (!file) {
      throw new BadRequestException('No photo file provided');
    }

    // 1. Validar EXIF
    const validation = this.exifParser.validatePhoto(file.buffer);

    if (!validation.valid) {
      this.logger.warn(`EXIF validation failed`, {
        projectId,
        errors: validation.errors,
      });

      throw new BadRequestException({
        message: 'Photo EXIF validation failed',
        errors: validation.errors,
      });
    }

    const exifData = validation.data!;

    // 2. Detectar tamper
    const fileModifiedTime = new Date(file.mimetype ? Date.now() : 0);
    const isTampered = this.exifParser.detectTamper(file.buffer, fileModifiedTime);

    if (isTampered) {
      this.logger.warn(`Photo tampering detected`, { projectId });
      throw new BadRequestException('Photo EXIF data appears to have been modified');
    }

    // 3. Validar GPS
    if (!this.exifParser.validateGPS(exifData.gpsLatitude, exifData.gpsLongitude)) {
      throw new BadRequestException('Invalid GPS coordinates in photo EXIF');
    }

    // 4. Validar timestamp EXIF
    const exifTimestamp = new Date(exifData.timestamp);
    if (Number.isNaN(exifTimestamp.getTime())) {
      throw new BadRequestException('Invalid EXIF timestamp');
    }

    // 5. Guardar en BD (en producción: S3/CDN)
    const photoRecord = await this.prisma.evidencePhoto.create({
      data: {
        projectId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        s3Url: `s3://semse-evidence/${projectId}/${file.originalname}`, // Placeholder
        exifTimestamp,
        gpsLatitude: exifData.gpsLatitude,
        gpsLongitude: exifData.gpsLongitude,
        gpsAltitude: exifData.gpsAltitude,
        cameraModel: exifData.cameraModel,
        status: 'VALIDATED',
        uploadedBy: actor.userId,
      },
    });

    this.logger.log(`Photo uploaded successfully: ${photoRecord.id}`, {
      projectId,
      timestamp: exifData.timestamp,
      coords: `${exifData.gpsLatitude}, ${exifData.gpsLongitude}`,
    });

    return {
      success: true,
      data: {
        photoId: photoRecord.id,
        filename: photoRecord.filename,
        status: photoRecord.status,
        timestamp: photoRecord.exifTimestamp,
        gps: {
          latitude: photoRecord.gpsLatitude,
          longitude: photoRecord.gpsLongitude,
          altitude: photoRecord.gpsAltitude,
        },
      },
    };
  }

  /**
   * GET /v1/projects/:projectId/evidence/photos
   *
   * Obtener todas las fotos del proyecto.
   */
  @Get('photos')
  async getPhotos(@Param('projectId') projectId: string) {
    this.logger.log(`GET /photos: ${projectId}`);

    const photos = await this.prisma.evidencePhoto.findMany({
      where: { projectId },
      orderBy: { exifTimestamp: 'desc' },
    });

    return {
      success: true,
      count: photos.length,
      data: photos.map((p) => ({
        id: p.id,
        filename: p.filename,
        timestamp: p.exifTimestamp,
        gps: { lat: p.gpsLatitude, lon: p.gpsLongitude },
        status: p.status,
      })),
    };
  }

  /**
   * GET /v1/projects/:projectId/evidence/photos/:photoId
   *
   * Obtener detalles de una foto.
   */
  @Get('photos/:photoId')
  async getPhotoDetails(
    @Param('projectId') projectId: string,
    @Param('photoId') photoId: string
  ) {
    const photo = await this.prisma.evidencePhoto.findFirstOrThrow({
      where: { id: photoId, projectId },
    });

    return {
      success: true,
      data: photo,
    };
  }
}
