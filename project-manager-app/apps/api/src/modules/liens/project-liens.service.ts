import { Injectable, Logger } from '@nestjs/common';
import { LiensService } from './liens.service.js';

/**
 * ProjectLiensService — crea calendarios de liens cuando se crea un proyecto.
 * Hook ejecutado en Project.onCreated o similares.
 */
@Injectable()
export class ProjectLiensService {
  private readonly logger = new Logger(ProjectLiensService.name);

  // Estados donde el sistema debería crear calendarios automáticamente
  // Para MVP: solo los 5 estados más comunes en construcción US
  private readonly targetStates = ['CA', 'TX', 'NY', 'FL', 'PA'];

  constructor(private readonly liensService: LiensService) {}

  /**
   * Crear calendarios de liens para un proyecto basado en su estado.
   * Llamado cuando se crea un proyecto.
   *
   * Extrae el estado de project.address y crea calendarios para
   * todos los estados relevantes (por ahora: top 5).
   */
  async createLienCalendarsForProject(
    projectId: string,
    address: string,
    projectStartDate: Date
  ): Promise<void> {
    this.logger.log(`Creating lien calendars for project: ${projectId}`);

    // 1. Extraer estado de la dirección (formato esperado: "...., STATE ZIP")
    const stateName = this.extractStateFromAddress(address);

    if (!stateName) {
      this.logger.warn(
        `Could not extract state from address: ${address}. Skipping lien calendars.`
      );
      return;
    }

    // 2. Verificar si es un estado donde creamos calendarios
    if (!this.targetStates.includes(stateName)) {
      this.logger.log(
        `State ${stateName} not in target list. Skipping (MVP: only ${this.targetStates.join(', ')})`
      );
      return;
    }

    // 3. Crear LienCalendar para este estado
    try {
      const calendar = await this.liensService.createLienCalendar(
        projectId,
        stateName,
        projectStartDate
      );

      this.logger.log(`Created lien calendar: ${calendar.id}`, {
        projectId,
        stateName,
        deadline: calendar.preliminaryNoticeDeadline,
      });
    } catch (error) {
      // Importante: NO bloquear creación del proyecto si falla LienGrid
      // Solo loguear el error
      this.logger.error(
        `Failed to create lien calendar for ${projectId} / ${stateName}`,
        error
      );
    }
  }

  /**
   * Extraer estado de una dirección.
   * Formato esperado: "123 Main St, San Francisco, CA 94102"
   * Retorna: "CA"
   *
   * Implementación simple: split por coma, último elemento antes del ZIP
   */
  private extractStateFromAddress(address: string): string | null {
    if (!address) return null;

    // Dividir por comas
    const parts = address.split(',').map((p) => p.trim());

    if (parts.length < 2) {
      // Formato no válido
      return null;
    }

    // Última parte es usualmente "STATE ZIP"
    const lastPart = parts[parts.length - 1];

    // Extraer estado (2 letras antes del ZIP)
    const match = lastPart.match(/^([A-Z]{2})\s+\d{5}/);
    if (match) {
      return match[1]; // Retorna el estado (2 letras)
    }

    return null;
  }

  /**
   * Para futuro (Fase 3): crear para TODOS los 50 estados
   * (no solo los 5 más comunes).
   */
  async createLienCalendarsForAllStates(
    projectId: string,
    address: string,
    projectStartDate: Date
  ): Promise<void> {
    // TODO: Cuando sea necesario, iterar sobre todos los 50 estados
    // y crear calendarios para cada uno.
  }
}
