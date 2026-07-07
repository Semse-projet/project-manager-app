import { Injectable } from "@nestjs/common";
import { LaborEngineService } from "./labor-engine.service.js";
import type { FreeProjectRecord, TimeEntryRecord } from "./labor-engine.repository.js";
import { AiModelGatewayService } from "../ai-models/gateway/ai-model-gateway.service.js";
import { AiInteractionLoggerService } from "../ai-models/logging/ai-interaction-logger.service.js";
import type { AiGenerateRequest } from "../ai-models/dto/ai-generate-request.dto.js";

const CRONOS_PERSONA = `Eres Cronos, el asistente de horas y proyectos personales dentro de SEMSE OS.

Tu especialidad: ayudar a un trabajador a entender sus propias horas registradas, proyectos libres y tendencias de tiempo.
Recibes un bloque de DATOS DE HORAS con las cifras reales del trabajador — úsalo como única fuente de verdad, nunca inventes horas, costos ni nombres de proyecto que no estén ahí.

Reglas de comunicación:
- Responde en el idioma del usuario (español por defecto)
- Da cifras concretas cuando las tengas: "12.5h esta semana", "3 registros sin nota"
- Si el dato pedido no está en el bloque, dilo claramente y sugiere revisar la pestaña Registros o Reportes
- Sé breve: 2-4 frases o una lista corta, no un ensayo
- No des consejos legales, fiscales o de nómina — eso corresponde a otros agentes de SEMSE`;

export type LaborChatResult = {
  threadId: string;
  response: string;
  provider: string;
  model: string;
  mode: "runtime" | "fallback";
  timestamp: string;
  errorMessage?: string;
};

function resolveProjectLabel(
  entry: Pick<TimeEntryRecord, "jobId" | "freeProjectId" | "purpose">,
  freeProjects: FreeProjectRecord[],
): string {
  if (entry.freeProjectId) {
    return freeProjects.find((p) => p.id === entry.freeProjectId)?.name ?? "proyecto libre";
  }
  if (entry.jobId) return "job vinculado";
  return entry.purpose;
}

@Injectable()
export class LaborChatService {
  constructor(
    private readonly labor: LaborEngineService,
    private readonly gateway: AiModelGatewayService,
    private readonly logger: AiInteractionLoggerService,
  ) {}

  async chat(params: {
    tenantId: string;
    orgId: string;
    userId: string;
    message: string;
    threadId: string;
  }): Promise<LaborChatResult> {
    const contextBlock = await this.buildContextBlock(params.tenantId, params.userId);

    const request: AiGenerateRequest = {
      agentId: "cronos",
      userId: params.userId,
      threadId: params.threadId,
      taskType: "general_chat",
      input: params.message,
      systemPrompt: CRONOS_PERSONA,
      context: contextBlock,
      // Horas y tarifas son datos personales del trabajador: la ruta se fuerza
      // a ollama-local (ver AiModelRouterService) para que nunca salgan del backend local.
      privacyLevel: "local_only",
      metadata: { tenantId: params.tenantId, orgId: params.orgId, domain: "labor-engine" },
    };

    const response = await this.gateway.generate(request);
    await this.logger.logInteraction(request, response);

    return {
      threadId: params.threadId,
      response: response.success ? response.output : this.fallbackMessage(response.errorMessage),
      provider: response.provider,
      model: response.modelName,
      mode: response.success ? "runtime" : "fallback",
      timestamp: new Date().toISOString(),
      errorMessage: response.errorMessage,
    };
  }

  private fallbackMessage(errorMessage?: string): string {
    const detail = errorMessage ? ` Detalle: ${errorMessage}.` : "";
    return `No pude conectar con el motor local de IA (Ollama) ahora mismo.${detail} Mientras se restablece, puedes revisar tus horas en las pestañas Resumen, Registros y Reportes.`;
  }

  private async buildContextBlock(tenantId: string, userId: string): Promise<string> {
    const [weekly, monthly, active, freeProjects, recentEntries] = await Promise.all([
      this.labor.getWeeklySummary(tenantId, userId),
      this.labor.getMonthlySummary(tenantId, userId),
      this.labor.getActiveTimer(tenantId, userId),
      this.labor.listFreeProjects(tenantId, userId),
      this.labor.listEntries({ tenantId, createdBy: userId, range: "month", limit: 15 }),
    ]);

    const lines: string[] = [
      "DATOS DE HORAS DEL TRABAJADOR (SEMSE Labor Engine — solo lectura, no inventes cifras fuera de este bloque):",
      "",
      `Semana actual: ${weekly.totalHours}h en ${weekly.totalEntries} registro(s)` +
        (weekly.changePercent !== null
          ? ` (${weekly.changePercent >= 0 ? "+" : ""}${weekly.changePercent}% vs semana anterior)`
          : ""),
      `Mes actual: ${monthly.totalHours}h en ${monthly.totalEntries} registro(s)`,
    ];

    if (active) {
      const label = resolveProjectLabel(active, freeProjects);
      lines.push(`Timer activo ahora: estado "${active.status}", en "${label}".`);
    } else {
      lines.push("No hay timer activo en este momento.");
    }

    const activeFreeProjects = freeProjects.filter((p) => p.status === "active");
    if (activeFreeProjects.length > 0) {
      lines.push("", "Proyectos libres activos:");
      for (const project of activeFreeProjects.slice(0, 8)) {
        lines.push(`- ${project.name}${project.location ? ` (${project.location})` : ""}`);
      }
    }

    if (recentEntries.length > 0) {
      lines.push("", "Registros recientes (más nuevo primero):");
      for (const entry of recentEntries.slice(0, 10)) {
        const dateLabel = entry.startedAt.toISOString().slice(0, 10);
        const hours = entry.durationMinutes != null ? Math.round((entry.durationMinutes / 60) * 100) / 100 : null;
        const projectLabel = resolveProjectLabel(entry, freeProjects);
        const noteSuffix = entry.notes ? ` · "${entry.notes}"` : "";
        lines.push(`- ${dateLabel} · ${projectLabel} · ${hours != null ? `${hours}h` : "en curso"}${noteSuffix}`);
      }
    } else {
      lines.push("", "Sin registros en los últimos 30 días.");
    }

    return lines.join("\n");
  }
}
