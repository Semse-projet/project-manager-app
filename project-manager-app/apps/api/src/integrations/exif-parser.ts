import { Logger } from '@nestjs/common';

/**
 * EXIF parser para validar metadatos de fotos.
 * Requiere: DateTimeOriginal (timestamp) + GPS (lat, lon)
 *
 * En producción: usar piexifjs o exif-parser package
 * Por ahora: parser simplificado para testing
 */

export interface EXIFData {
  timestamp: string; // ISO format
  gpsLatitude: number;
  gpsLongitude: number;
  gpsAltitude?: number;
  cameraModel?: string;
  isValidated: boolean;
}

export interface ValidationResult {
  valid: boolean;
  data?: EXIFData;
  errors: string[];
}

export class EXIFParser {
  private readonly logger = new Logger(EXIFParser.name);

  /**
   * Validar EXIF data en un buffer de foto.
   * Retorna {valid: true, data: {...}} o {valid: false, errors: [...]}
   */
  validatePhoto(photoBuffer: Buffer): ValidationResult {
    const errors: string[] = [];

    try {
      // En producción: usar piexifjs.load(buffer)
      // Por ahora: simular extraction
      const exif = this.extractEXIF(photoBuffer);

      if (!exif.timestamp) {
        errors.push('Missing DateTimeOriginal in EXIF');
      }

      if (!exif.gpsLatitude || !exif.gpsLongitude) {
        errors.push('Missing GPS coordinates in EXIF');
      }

      if (errors.length > 0) {
        return { valid: false, errors };
      }

      return {
        valid: true,
        data: {
          ...exif,
          timestamp: exif.timestamp!,
          gpsLatitude: exif.gpsLatitude!,
          gpsLongitude: exif.gpsLongitude!,
          isValidated: true,
        },
        errors: [],
      };
    } catch (error) {
      this.logger.error('EXIF validation failed', error);
      return {
        valid: false,
        errors: [`EXIF parse error: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Extraer EXIF data (simulado).
   * En producción: usar piexifjs.load(buffer)
   */
  private extractEXIF(buffer: Buffer): Partial<EXIFData> {
    // Búsqueda simplificada de markers EXIF
    // En producción: usar piexifjs o exif-parser

    const data: Partial<EXIFData> = {};

    // Detectar si tiene JPEG header
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      this.logger.warn('Not a valid JPEG file');
      return {};
    }

    // Búsqueda simplificada (en producción: parser real)
    // Buscar 'Exif' marker (0xffe1)
    let exifMarkerIndex = -1;
    for (let i = 0; i < buffer.length - 6; i++) {
      if (buffer[i] === 0xff && buffer[i + 1] === 0xe1) {
        // Found APP1 marker (EXIF)
        exifMarkerIndex = i;
        break;
      }
    }

    if (exifMarkerIndex === -1) {
      this.logger.warn('No EXIF data found in photo');
      return {};
    }

    // Simular extracción (en producción: parsear real)
    data.timestamp = new Date().toISOString();
    data.gpsLatitude = 37.7749; // Simulated SF
    data.gpsLongitude = -122.4194;
    data.cameraModel = 'Simulated Camera';

    return data;
  }

  /**
   * Detectar si EXIF fue modificado (tamper detection).
   * Compara timestamp EXIF vs metadata de archivo.
   */
  detectTamper(photoBuffer: Buffer, fileModifiedTime: Date): boolean {
    const exif = this.extractEXIF(photoBuffer);

    if (!exif.timestamp) {
      return false;
    }

    const exifTime = new Date(exif.timestamp);
    const timeDiffSeconds = Math.abs(exifTime.getTime() - fileModifiedTime.getTime()) / 1000;

    // Si la diferencia es > 24 horas, probablemente fue modificado
    if (timeDiffSeconds > 86400) {
      this.logger.warn('Possible EXIF tamper detected', {
        exifTime,
        fileModifiedTime,
        diffSeconds: timeDiffSeconds,
      });
      return true;
    }

    return false;
  }

  /**
   * Validar coordenadas GPS.
   * Retorna true si están dentro de rango válido.
   */
  validateGPS(latitude: number, longitude: number): boolean {
    // Validar rangos
    if (latitude < -90 || latitude > 90) {
      return false;
    }

    if (longitude < -180 || longitude > 180) {
      return false;
    }

    return true;
  }
}
